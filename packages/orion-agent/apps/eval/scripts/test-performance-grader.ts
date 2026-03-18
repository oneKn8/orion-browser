/**
 * Test script for the PerformanceGrader.
 *
 * Runs against a real trajectory and logs:
 * - Pre-computed metrics passed to the agent
 * - Every tool call the agent makes (what it reads/greps)
 * - The final grading result with per-axis scores
 *
 * Uses the running Claude Code process for auth (no API key needed).
 *
 * Usage: bun run apps/eval/scripts/test-performance-grader.ts [output-dir]
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import {
  buildUserPrompt,
  DEFAULT_AXES,
  PERFORMANCE_SYSTEM_PROMPT,
} from '../src/graders/performance/axes'
import { extractMetrics } from '../src/graders/performance/metadata-extractor'
import {
  DEFAULT_MAX_BUDGET_USD,
  DEFAULT_MAX_TURNS,
  DEFAULT_PASS_THRESHOLD,
} from '../src/graders/performance/performance-grader'
import {
  PERFORMANCE_EVAL_SCHEMA,
  type PerformanceEvalResponse,
} from '../src/graders/performance/types'
import { MessageSchema } from '../src/types/message'

const DEFAULT_SAMPLE = 'results/webvoyager-restart/Allrecipes--0'

async function main() {
  const outputDir = process.argv[2]
    ? process.argv[2]
    : join(process.cwd(), DEFAULT_SAMPLE)

  console.log(`\n=== Performance Grader Test ===`)
  console.log(`Output dir: ${outputDir}\n`)

  // 1. Load messages
  const rawLines = (await readFile(join(outputDir, 'messages.jsonl'), 'utf-8'))
    .split('\n')
    .filter(Boolean)

  const messages = rawLines.map((line) => MessageSchema.parse(JSON.parse(line)))
  console.log(`Loaded ${messages.length} messages from messages.jsonl`)

  // 2. Load metadata
  const metadata = JSON.parse(
    await readFile(join(outputDir, 'metadata.json'), 'utf-8'),
  )
  console.log(`Task: ${metadata.query}`)
  console.log(`Duration: ${metadata.total_duration_ms}ms`)
  console.log(`Screenshots: ${metadata.total_steps}`)

  // 3. Extract metrics
  const metrics = extractMetrics(
    messages,
    metadata.total_steps,
    metadata.termination_reason || 'unknown',
  )

  console.log(`\n--- Pre-Computed Metrics (passed to agent) ---`)
  console.log(JSON.stringify(metrics, null, 2))

  // 4. Build prompt
  const systemPrompt = PERFORMANCE_SYSTEM_PROMPT.replace(
    /\{screenshot_count\}/g,
    String(metrics.screenshotCount),
  )
  const userPrompt = buildUserPrompt(
    metadata.query,
    metadata.final_answer,
    metrics,
    DEFAULT_AXES,
  )

  console.log(`\nPrompt size: ${userPrompt.length} chars`)
  console.log(`System prompt size: ${systemPrompt.length} chars`)

  // 5. Run agent — log every tool call to see its trajectory
  console.log(`\n=== Agent Trajectory ===\n`)

  let turnCount = 0
  let toolCallCount = 0

  for await (const message of query({
    prompt: userPrompt,
    options: {
      model: 'claude-sonnet-4-20250514',
      cwd: outputDir,
      systemPrompt,
      allowedTools: ['Read', 'Glob', 'Grep'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: DEFAULT_MAX_TURNS,
      maxBudgetUsd: DEFAULT_MAX_BUDGET_USD,
      outputFormat: {
        type: 'json_schema',
        schema: PERFORMANCE_EVAL_SCHEMA,
      },
      env: {
        ...process.env,
        CLAUDECODE: '',
      },
    },
  })) {
    if (message.type === 'assistant') {
      turnCount++
      console.log(`--- Turn ${turnCount} ---`)

      for (const block of message.message.content) {
        if (block.type === 'text' && block.text) {
          const preview =
            block.text.length > 400
              ? `${block.text.slice(0, 400)}...`
              : block.text
          console.log(`  [text] ${preview}`)
        }
        if (block.type === 'tool_use') {
          toolCallCount++
          const input = block.input as Record<string, unknown>
          // Show what the agent is reading/grepping
          if (block.name === 'Read') {
            console.log(
              `  [tool #${toolCallCount}] Read → ${input.file_path}${input.limit ? ` (lines ${input.offset || 1}-${(input.offset || 1) + Number(input.limit)})` : ''}`,
            )
          } else if (block.name === 'Grep') {
            console.log(
              `  [tool #${toolCallCount}] Grep → pattern="${input.pattern}" path="${input.path || '.'}"`,
            )
          } else if (block.name === 'Glob') {
            console.log(`  [tool #${toolCallCount}] Glob → ${input.pattern}`)
          } else {
            console.log(
              `  [tool #${toolCallCount}] ${block.name}(${JSON.stringify(input).slice(0, 150)})`,
            )
          }
        }
      }
    }

    if (message.type === 'result') {
      console.log(`\n=== Result ===`)
      console.log(`Status: ${message.subtype}`)
      console.log(`Turns: ${message.num_turns}`)
      console.log(`Tool calls: ${toolCallCount}`)
      console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`)

      if (message.subtype === 'success') {
        console.log(`\n--- Scores ---`)
        const axes = (
          message.structured_output as PerformanceEvalResponse | undefined
        )?.axes
        if (Array.isArray(axes)) {
          let composite = 0
          for (const a of axes) {
            const def = DEFAULT_AXES.find((d) => d.name === a.axis)
            const weight = def?.weight ?? 0
            composite += a.score * weight
            console.log(
              `  ${a.axis}: ${a.score}/100 (weight: ${weight}) — ${a.reasoning}`,
            )
          }
          console.log(`\n  Composite: ${composite.toFixed(1)}/100`)
          console.log(
            `  Pass (>= ${DEFAULT_PASS_THRESHOLD}): ${composite >= DEFAULT_PASS_THRESHOLD ? 'YES' : 'NO'}`,
          )
        }
      } else {
        console.log(`Error: ${message.result}`)
      }
    }
  }
}

main().catch(console.error)
