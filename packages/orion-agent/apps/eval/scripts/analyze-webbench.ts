/**
 * Analyze WebBench results across 4 agents to stratify tasks by pass count.
 * Usage: bun apps/eval/scripts/analyze-webbench.ts
 */
import { parse } from 'csv-parse/sync'

const dataDir = 'apps/eval/data/webbench'

interface AgentConfig {
  file: string
  evalCol: string
  name: string
}

const agents: AgentConfig[] = [
  { file: 'anthropicfinal.csv', evalCol: 'Anthropic_Eval', name: 'Anthropic' },
  { file: 'skyvern2.0final.csv', evalCol: 'Skyvern2.0Eval', name: 'Skyvern' },
  { file: 'openaicuafinal.csv', evalCol: 'CUAEval', name: 'OpenAI CUA' },
  { file: 'browserusefinal.csv', evalCol: 'BUEval', name: 'BrowserUse' },
]

type Row = Record<string, string>

// Parse each agent's results
const agentResults = new Map<
  string,
  Map<
    number,
    {
      eval: string
      difficulty: string
      category: string
      task: string
      url: string
    }
  >
>()

for (const agent of agents) {
  const text = await Bun.file(`${dataDir}/${agent.file}`).text()
  const rows: Row[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
  const results = new Map<
    number,
    {
      eval: string
      difficulty: string
      category: string
      task: string
      url: string
    }
  >()
  for (const row of rows) {
    const id = parseInt(row.ID, 10)
    if (Number.isNaN(id)) continue
    results.set(id, {
      eval: row[agent.evalCol] || '',
      difficulty: row.Difficulty || '',
      category: row.Category || '',
      task: row.Task || '',
      url: row['Starting URL'] || '',
    })
  }
  agentResults.set(agent.name, results)
  console.log(`${agent.name}: ${results.size} tasks loaded`)
}

// Find common task IDs (present in all 4 agents)
const allIds = new Set<number>()
for (const [, results] of agentResults) {
  for (const id of results.keys()) allIds.add(id)
}

// Build pass count per task
interface TaskStats {
  id: number
  passCount: number
  difficulty: string
  category: string
  task: string
  url: string
  agents: Record<string, string>
}

const taskStats: TaskStats[] = []
const _fullAgentNames = agents.map((a) => a.name)

for (const id of allIds) {
  let passCount = 0
  let _presentCount = 0
  const agentEvals: Record<string, string> = {}
  let difficulty = ''
  let category = ''
  let task = ''
  let url = ''

  for (const agent of agents) {
    const result = agentResults.get(agent.name)?.get(id)
    if (result) {
      _presentCount++
      const isSuccess = result.eval?.toLowerCase().includes('success')
      if (isSuccess) passCount++
      agentEvals[agent.name] = isSuccess ? 'PASS' : 'FAIL'
      if (!difficulty) difficulty = result.difficulty
      if (!category) category = result.category
      if (!task) task = result.task
      if (!url) url = result.url
    } else {
      agentEvals[agent.name] = 'N/A'
    }
  }

  taskStats.push({
    id,
    passCount,
    difficulty,
    category,
    task,
    url,
    agents: agentEvals,
  })
}

// Group by pass count
const byPassCount: Record<number, TaskStats[]> = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
}
for (const t of taskStats) {
  byPassCount[t.passCount].push(t)
}

console.log('\n═══════════════════════════════════════════════════')
console.log('TASKS BY PASS COUNT (how many agents succeeded)')
console.log('═══════════════════════════════════════════════════\n')

for (let pc = 0; pc <= 4; pc++) {
  const tasks = byPassCount[pc]
  const label =
    pc === 0 ? '0/4 (ALL FAIL)' : pc === 4 ? '4/4 (ALL PASS)' : `${pc}/4`
  console.log(`${label}: ${tasks.length} tasks`)

  // Breakdown by difficulty
  const easy = tasks.filter((t) => t.difficulty === 'easy').length
  const hard = tasks.filter((t) => t.difficulty === 'hard').length
  console.log(`  easy: ${easy}, hard: ${hard}`)

  // Breakdown by category
  const byCat: Record<string, number> = {}
  for (const t of tasks) {
    byCat[t.category] = (byCat[t.category] || 0) + 1
  }
  console.log(
    `  categories: ${Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c}(${n})`)
      .join(', ')}`,
  )
  console.log()
}

// Now handle BrowserUse only having 658 tasks — let's also do a 3-agent view (Anthropic, Skyvern, OpenAI)
console.log('\n═══════════════════════════════════════════════════')
console.log('3-AGENT VIEW (Anthropic + Skyvern + OpenAI CUA)')
console.log('(BrowserUse only has 658 tasks, so this is more complete)')
console.log('═══════════════════════════════════════════════════\n')

const threeAgents = ['Anthropic', 'Skyvern', 'OpenAI CUA']
const byPassCount3: Record<number, TaskStats[]> = { 0: [], 1: [], 2: [], 3: [] }

for (const t of taskStats) {
  let pc3 = 0
  let allPresent = true
  for (const a of threeAgents) {
    if (t.agents[a] === 'N/A') {
      allPresent = false
      break
    }
    if (t.agents[a] === 'PASS') pc3++
  }
  if (!allPresent) continue
  if (!byPassCount3[pc3]) byPassCount3[pc3] = []
  byPassCount3[pc3].push(t)
}

let total3 = 0
for (let pc = 0; pc <= 3; pc++) {
  const tasks = byPassCount3[pc]
  total3 += tasks.length
  const label =
    pc === 0 ? '0/3 (ALL FAIL)' : pc === 3 ? '3/3 (ALL PASS)' : `${pc}/3`
  console.log(`${label}: ${tasks.length} tasks`)

  const easy = tasks.filter((t) => t.difficulty === 'easy').length
  const hard = tasks.filter((t) => t.difficulty === 'hard').length
  console.log(`  easy: ${easy}, hard: ${hard}`)

  const byCat: Record<string, number> = {}
  for (const t of tasks) {
    byCat[t.category] = (byCat[t.category] || 0) + 1
  }
  console.log(
    `  categories: ${Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c}(${n})`)
      .join(', ')}`,
  )

  // Show unique websites count
  const uniqueUrls = new Set(tasks.map((t) => t.url))
  console.log(`  unique websites: ${uniqueUrls.size}`)
  console.log()
}
console.log(`Total tasks in 3-agent intersection: ${total3}`)

// Quick sample of 0/3 tasks (hardest)
console.log('\n── Sample 0/3 (all fail) tasks ──')
byPassCount3[0].slice(0, 5).forEach((t) => {
  console.log(`  [${t.id}] [${t.difficulty}] [${t.category}] ${t.url}`)
  console.log(`    ${t.task.slice(0, 150)}`)
})

console.log('\n── Sample 1/3 tasks ──')
byPassCount3[1].slice(0, 5).forEach((t) => {
  console.log(`  [${t.id}] [${t.difficulty}] [${t.category}] ${t.url}`)
  console.log(`    ${t.task.slice(0, 150)}`)
})
