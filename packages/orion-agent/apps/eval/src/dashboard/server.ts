import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { ParallelExecutor } from '../runner/parallel-executor'
import { loadTasks } from '../runner/task-loader'
import { resolveGraderOptions } from '../runner/types'
import { EvalConfigSchema, type Task } from '../types'

// ============================================================================
// Types
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'

export interface DashboardTask {
  queryId: string
  query: string
  startUrl?: string
  status: TaskStatus
  durationMs?: number
  graderResults?: Record<
    string,
    {
      pass: boolean
      score: number
      reasoning?: string
      details?: Record<string, unknown>
    }
  >
  screenshotCount: number
}

export interface DashboardEvent {
  type: string
  taskId: string
  [key: string]: unknown
}

// ============================================================================
// Dashboard State
// ============================================================================

class DashboardState {
  tasks: DashboardTask[] = []
  configName = ''
  agentType = ''
  outputDir = ''
  private sseClients: Set<(event: DashboardEvent) => void> = new Set()

  init(
    tasks: Task[],
    configName: string,
    agentType: string,
    outputDir: string,
  ) {
    this.configName = configName
    this.agentType = agentType
    this.outputDir = outputDir
    this.tasks = tasks.map((t) => ({
      queryId: t.query_id,
      query: t.query,
      startUrl: t.start_url,
      status: 'pending',
      screenshotCount: 0,
    }))
  }

  broadcastStreamEvent(taskId: string, event: Record<string, unknown>) {
    // Update internal task state for task-state events
    if (event.type === 'task-state') {
      const status = event.status as TaskStatus
      const task = this.tasks.find((t) => t.queryId === taskId)
      if (task) {
        task.status = status
        if (event.durationMs) task.durationMs = event.durationMs as number
        if (event.graderResults)
          task.graderResults = event.graderResults as Record<
            string,
            {
              pass: boolean
              score: number
              reasoning?: string
              details?: Record<string, unknown>
            }
          >
        if (event.screenshotCount !== undefined)
          task.screenshotCount = event.screenshotCount as number
      }
    }

    // Track screenshot count from tool-output events
    if (event.screenshot && typeof event.screenshot === 'number') {
      const task = this.tasks.find((t) => t.queryId === taskId)
      if (task && event.screenshot > task.screenshotCount) {
        task.screenshotCount = event.screenshot as number
      }
    }

    this.broadcast({ ...event, type: event.type as string, taskId })
  }

  subscribe(fn: (event: DashboardEvent) => void) {
    this.sseClients.add(fn)
    return () => this.sseClients.delete(fn)
  }

  private broadcast(event: DashboardEvent) {
    for (const fn of this.sseClients) {
      try {
        fn(event)
      } catch {
        /* client disconnected */
      }
    }
  }
}

export const dashboardState = new DashboardState()

let evalRunning = false
let activeExecutor: ParallelExecutor | null = null
let dashboardConfigMode = false
const configsDir = join(import.meta.dir, '..', '..', 'configs')
const projectRoot = resolve(import.meta.dir, '..', '..', '..', '..')

// ============================================================================
// Hono App
// ============================================================================

const app = new Hono()

app.get('/', async (c) => {
  const html = await readFile(join(import.meta.dir, 'index.html'), 'utf-8')
  return c.html(html)
})

app.get('/api/state', (c) => {
  return c.json({
    configName: dashboardState.configName,
    agentType: dashboardState.agentType,
    tasks: dashboardState.tasks,
  })
})

app.get('/api/events', (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = dashboardState.subscribe((event) => {
      stream.writeSSE({ data: JSON.stringify(event) }).catch(() => {})
    })

    try {
      // Keep alive until client disconnects
      while (true) {
        await stream.writeSSE({ data: '', event: 'ping' })
        await stream.sleep(10000)
      }
    } finally {
      unsubscribe()
    }
  })
})

app.get('/api/screenshots/:taskId/:index', async (c) => {
  const { taskId, index } = c.req.param()
  if (
    taskId.includes('..') ||
    taskId.includes('/') ||
    index.includes('..') ||
    index.includes('/')
  ) {
    return c.json({ error: 'Invalid parameters' }, 400)
  }
  const filepath = join(
    dashboardState.outputDir,
    taskId,
    'screenshots',
    `${index}.png`,
  )
  const resolved = resolve(filepath)
  if (!resolved.startsWith(resolve(dashboardState.outputDir))) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  try {
    const file = Bun.file(filepath)
    if (!(await file.exists())) return c.notFound()
    const data = await file.arrayBuffer()
    return c.body(data, 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache',
    })
  } catch {
    return c.notFound()
  }
})

// ============================================================================
// Config & Run API
// ============================================================================

app.get('/api/mode', (c) => {
  return c.json({
    configMode: dashboardConfigMode && !evalRunning,
    running: evalRunning,
  })
})

// List saved config files
app.get('/api/configs', async (c) => {
  try {
    const files = await readdir(configsDir)
    return c.json(files.filter((f) => f.endsWith('.json')))
  } catch {
    return c.json([])
  }
})

// Read a specific config file
app.get('/api/config/:name', async (c) => {
  const name = c.req.param('name')
  if (name.includes('/') || name.includes('..')) {
    return c.json({ error: 'Invalid config name' }, 400)
  }
  try {
    const content = await readFile(join(configsDir, name), 'utf-8')
    return c.json(JSON.parse(content))
  } catch {
    return c.notFound()
  }
})

// Start an eval run from the dashboard
app.post('/api/run', async (c) => {
  if (evalRunning) return c.json({ error: 'Eval already running' }, 409)

  let body: { config: unknown; configName?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Validate config against Zod schema
  const parseResult = EvalConfigSchema.safeParse(body.config)
  if (!parseResult.success) {
    const errors = parseResult.error.errors.map(
      (e) => `${e.path.join('.')}: ${e.message}`,
    )
    return c.json({ error: 'Config validation failed', details: errors }, 400)
  }

  const config = parseResult.data

  // Resolve relative paths from configs/ dir (dataset dropdown values are relative to it)
  const baseDir = configsDir
  const datasetPath = resolve(
    config.dataset.startsWith('/')
      ? config.dataset
      : join(baseDir, config.dataset),
  )
  const outputDir = config.output_dir
    ? resolve(
        config.output_dir.startsWith('/')
          ? config.output_dir
          : join(baseDir, config.output_dir),
      )
    : join(configsDir, '..', 'results', `dashboard-${Date.now()}`)

  const resolvedRoot = resolve(projectRoot)
  const resolvedRootPrefix = resolvedRoot.endsWith('/')
    ? resolvedRoot
    : `${resolvedRoot}/`
  if (!datasetPath.startsWith(resolvedRootPrefix)) {
    return c.json(
      { error: 'Invalid dataset path: must be within project root' },
      400,
    )
  }
  if (!resolve(outputDir).startsWith(resolvedRootPrefix)) {
    return c.json(
      { error: 'Invalid output_dir path: must be within project root' },
      400,
    )
  }

  // Load tasks from dataset
  let tasks: Task[]
  try {
    const result = await loadTasks({ type: 'file', path: datasetPath })
    tasks = result.tasks
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return c.json({ error: `Failed to load tasks: ${msg}` }, 400)
  }

  await mkdir(outputDir, { recursive: true })

  // Re-init dashboard state with loaded tasks
  const configLabel = body.configName || 'dashboard'
  dashboardState.init(tasks, configLabel, config.agent.type, outputDir)

  const graderOptions = resolveGraderOptions(config)

  // Run eval in background — don't await
  const executor = new ParallelExecutor({
    numWorkers: config.num_workers || 1,
    config,
    outputDir,
    graderOptions,
    restartServerPerTask: config.restart_server_per_task,
    onEvent: (taskId, event) =>
      dashboardState.broadcastStreamEvent(taskId, event),
  })
  activeExecutor = executor
  evalRunning = true
  dashboardConfigMode = false

  executor
    .execute(tasks, (completed, total, task, result) => {
      const status =
        result.status === 'completed'
          ? 'DONE'
          : result.status === 'timeout'
            ? 'TIMEOUT'
            : 'FAILED'
      const dur =
        result.durationMs > 0
          ? ` (${(result.durationMs / 1000).toFixed(1)}s)`
          : ''
      console.log(`[${completed}/${total}] ${task.query_id}: ${status}${dur}`)
    })
    .finally(() => {
      evalRunning = false
      activeExecutor = null
      console.log('\nEval run complete.')
    })

  return c.json({ status: 'started', taskCount: tasks.length, outputDir })
})

// Stop a running eval
app.post('/api/stop', async (c) => {
  if (!evalRunning || !activeExecutor) {
    return c.json({ error: 'No eval running' }, 409)
  }
  await activeExecutor.stop()
  evalRunning = false
  activeExecutor = null

  // Notify all SSE clients
  dashboardState.broadcastStreamEvent('_system', {
    type: 'eval-stopped',
  })

  return c.json({ status: 'stopped' })
})

// ============================================================================
// Server Lifecycle
// ============================================================================

let server: ReturnType<typeof Bun.serve> | null = null

export interface DashboardConfig {
  port?: number
  tasks: Task[]
  configName: string
  agentType: string
  outputDir: string
  configMode?: boolean
}

export function startDashboard(config: DashboardConfig) {
  const port = config.port ?? 9900
  dashboardConfigMode = config.configMode ?? false

  dashboardState.init(
    config.tasks,
    config.configName,
    config.agentType,
    config.outputDir,
  )

  server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch: app.fetch,
    idleTimeout: 255,
  })

  const url = `http://localhost:${port}`
  console.log(`  Dashboard: ${url}`)

  // Auto-open browser
  try {
    Bun.spawn(['open', url], { stdout: 'ignore', stderr: 'ignore' })
  } catch {
    /* ignore if open command fails */
  }

  return { url, port }
}

export function setActiveExecutor(executor: ParallelExecutor | null) {
  activeExecutor = executor
  evalRunning = executor !== null
}

export function stopDashboard() {
  if (server) {
    server.stop()
    server = null
  }
}
