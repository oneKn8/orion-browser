#!/usr/bin/env bun
/**
 * Annotate Screenshots with Tool Coordinates
 *
 * Reads messages.jsonl from an eval run and annotates screenshots with
 * coordinate markers showing where browser actions (click, fill, hover, drag)
 * actually landed.
 *
 * Coordinates are in CSS pixels (returned by tool outputs). They're mapped to
 * screenshot pixels using: screenshot_xy = css_xy × devicePixelRatio
 *
 * Usage:
 *   bun run apps/eval/scripts/annotate-screenshots.ts <results-folder> [--dpr=2]
 *
 * Options:
 *   --dpr=N   devicePixelRatio (default: 2). Use the value from take_screenshot output.
 *
 * Output:
 *   Creates an 'annotated' folder inside the screenshots directory.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import sharp from 'sharp'

interface ActionInfo {
  screenshotNum: number
  toolName: string
  cssX: number
  cssY: number
  // For drag: second coordinate
  cssX2?: number
  cssY2?: number
}

const COORDINATE_TOOLS = new Set([
  'click',
  'click_at',
  'fill',
  'hover',
  'hover_at',
  'type_at',
  'drag',
  'drag_at',
])

/**
 * Parse CSS coordinates from tool output text.
 *
 * Formats returned by tools:
 *   "Clicked [47] at (125, 42)"
 *   "Typed 5 characters into [12] at (300, 150)"
 *   "Hovered over [31] at (200, 88)"
 *   "Clicked at (125, 42)"
 *   "Hovered at (125, 42)"
 *   "Typed 10 chars at (125, 42)"
 *   "Dragged [10] (50, 100) → [20] (400, 300)"
 *   "Dragged from (50, 100) to (400, 300)"
 */
function parseCoordinates(
  toolName: string,
  output: unknown,
): { x: number; y: number; x2?: number; y2?: number } | null {
  const text = extractText(output)
  if (!text) return null

  // Drag with two coordinate pairs: "(x1, y1) → ... (x2, y2)" or "from (x1, y1) to (x2, y2)"
  if (toolName === 'drag' || toolName === 'drag_at') {
    const dragMatch = text.match(
      /\((\d+),\s*(\d+)\).*?(?:→|to)\s*.*?\((\d+),\s*(\d+)\)/,
    )
    if (dragMatch) {
      return {
        x: Number(dragMatch[1]),
        y: Number(dragMatch[2]),
        x2: Number(dragMatch[3]),
        y2: Number(dragMatch[4]),
      }
    }
  }

  // Single coordinate: "at (x, y)" or just "(x, y)"
  const singleMatch = text.match(/\((\d+),\s*(\d+)\)/)
  if (singleMatch) {
    return { x: Number(singleMatch[1]), y: Number(singleMatch[2]) }
  }

  return null
}

function extractText(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.type === 'text' && typeof item.text === 'string')
        return item.text
    }
  }
  if (output && typeof output === 'object' && 'text' in output) {
    return String((output as Record<string, unknown>).text)
  }
  return null
}

/**
 * Parse messages.jsonl to extract actions with coordinates
 */
function parseMessages(messagesPath: string): ActionInfo[] {
  const content = readFileSync(messagesPath, 'utf-8')
  const lines = content.trim().split('\n')
  const messages = lines.map((line) => JSON.parse(line))

  const actions: ActionInfo[] = []
  const pendingTools = new Map<
    string,
    { toolName: string; screenshotNum: number }
  >()
  let screenshotNum = 0

  for (const msg of messages) {
    if (msg.type === 'tool-input-available') {
      pendingTools.set(msg.toolCallId, {
        toolName: msg.toolName,
        screenshotNum: -1,
      })
    }

    if (msg.type === 'tool-output-available') {
      screenshotNum++
      const pending = pendingTools.get(msg.toolCallId)
      if (!pending) continue

      if (!COORDINATE_TOOLS.has(pending.toolName)) {
        pendingTools.delete(msg.toolCallId)
        continue
      }

      const coords = parseCoordinates(pending.toolName, msg.output)
      if (coords) {
        actions.push({
          screenshotNum,
          toolName: pending.toolName,
          cssX: coords.x,
          cssY: coords.y,
          cssX2: coords.x2,
          cssY2: coords.y2,
        })
      }

      pendingTools.delete(msg.toolCallId)
    }
  }

  return actions
}

async function annotateScreenshot(
  inputPath: string,
  outputPath: string,
  action: ActionInfo | null,
  dpr: number,
): Promise<void> {
  if (!action) {
    copyFileSync(inputPath, outputPath)
    return
  }

  const image = sharp(inputPath)
  const metadata = await image.metadata()
  const imgWidth = metadata.width!
  const imgHeight = metadata.height!

  const sx = Math.round(action.cssX * dpr)
  const sy = Math.round(action.cssY * dpr)

  let markersSvg = ''

  // Primary marker (red crosshair)
  markersSvg += `
    <circle cx="${sx}" cy="${sy}" r="25" fill="none" stroke="red" stroke-width="4"/>
    <circle cx="${sx}" cy="${sy}" r="6" fill="red" fill-opacity="0.6"/>
    <line x1="${sx - 40}" y1="${sy}" x2="${sx - 10}" y2="${sy}" stroke="red" stroke-width="3"/>
    <line x1="${sx + 10}" y1="${sy}" x2="${sx + 40}" y2="${sy}" stroke="red" stroke-width="3"/>
    <line x1="${sx}" y1="${sy - 40}" x2="${sx}" y2="${sy - 10}" stroke="red" stroke-width="3"/>
    <line x1="${sx}" y1="${sy + 10}" x2="${sx}" y2="${sy + 40}" stroke="red" stroke-width="3"/>
  `

  // Drag target marker (orange)
  if (action.cssX2 !== undefined && action.cssY2 !== undefined) {
    const sx2 = Math.round(action.cssX2 * dpr)
    const sy2 = Math.round(action.cssY2 * dpr)
    markersSvg += `
      <circle cx="${sx2}" cy="${sy2}" r="25" fill="none" stroke="orange" stroke-width="4"/>
      <circle cx="${sx2}" cy="${sy2}" r="6" fill="orange" fill-opacity="0.6"/>
      <line x1="${sx}" y1="${sy}" x2="${sx2}" y2="${sy2}" stroke="orange" stroke-width="2" stroke-dasharray="8,4"/>
    `
  }

  // Info box
  const label2 =
    action.cssX2 !== undefined
      ? ` → (${action.cssX2}, ${action.cssY2}) css`
      : ''
  const infoText = `${action.toolName}: (${action.cssX}, ${action.cssY}) css × ${dpr} dpr = (${sx}, ${sy}) px${label2}`

  markersSvg += `
    <rect x="10" y="10" width="${Math.min(infoText.length * 8 + 20, imgWidth - 20)}" height="50" fill="rgba(0,0,0,0.9)" rx="5"/>
    <text x="20" y="30" fill="red" font-family="monospace" font-size="14" font-weight="bold">
      Screenshot ${action.screenshotNum}: AFTER ${action.toolName}
    </text>
    <text x="20" y="50" fill="white" font-family="monospace" font-size="12">
      ${infoText}
    </text>
  `

  const svg = `<svg width="${imgWidth}" height="${imgHeight}">${markersSvg}</svg>`

  await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toFile(outputPath)
}

async function main() {
  const args = process.argv.slice(2)
  const flags = args.filter((a) => a.startsWith('--'))
  const positional = args.filter((a) => !a.startsWith('--'))

  if (positional.length === 0) {
    console.log(
      'Usage: bun run apps/eval/scripts/annotate-screenshots.ts <results-folder> [--dpr=2]',
    )
    console.log('')
    console.log('Example:')
    console.log(
      '  bun run apps/eval/scripts/annotate-screenshots.ts apps/eval/results/single/Amazon--3',
    )
    process.exit(1)
  }

  const dprFlag = flags.find((f) => f.startsWith('--dpr='))
  let dpr = dprFlag ? Number(dprFlag.split('=')[1]) : 0

  // Try reading DPR from metadata.json if not explicitly provided
  if (!dpr) {
    const metadataPath = join(positional[0], 'metadata.json')
    if (existsSync(metadataPath)) {
      const meta = JSON.parse(readFileSync(metadataPath, 'utf-8'))
      dpr = meta.device_pixel_ratio ?? 0
      if (dpr) console.log(`Read devicePixelRatio=${dpr} from metadata.json`)
    }
  }
  if (!dpr) {
    console.error(
      'Error: devicePixelRatio not found in metadata.json. Provide --dpr=N flag.',
    )
    process.exit(1)
  }

  const resultsFolder = positional[0]
  const messagesPath = join(resultsFolder, 'messages.jsonl')
  const screenshotsDir = join(resultsFolder, 'screenshots')
  const annotatedDir = join(screenshotsDir, 'annotated')

  if (!existsSync(messagesPath)) {
    console.error(`Error: messages.jsonl not found at ${messagesPath}`)
    process.exit(1)
  }

  if (!existsSync(screenshotsDir)) {
    console.error(`Error: screenshots directory not found at ${screenshotsDir}`)
    process.exit(1)
  }

  mkdirSync(annotatedDir, { recursive: true })

  console.log(`devicePixelRatio: ${dpr}`)
  console.log('Parsing messages.jsonl...')
  const actions = parseMessages(messagesPath)

  console.log(`Found ${actions.length} actions with coordinates:`)
  for (const action of actions) {
    const dragInfo =
      action.cssX2 !== undefined ? ` → (${action.cssX2}, ${action.cssY2})` : ''
    console.log(
      `  Screenshot ${action.screenshotNum}: ${action.toolName} at (${action.cssX}, ${action.cssY})${dragInfo} css → (${Math.round(action.cssX * dpr)}, ${Math.round(action.cssY * dpr)}) px`,
    )
  }
  console.log('')

  const screenshots = readdirSync(screenshotsDir)
    .filter((f) => f.endsWith('.png') && !f.includes('annotated'))
    .sort((a, b) => {
      const numA = parseInt(basename(a, '.png'), 10)
      const numB = parseInt(basename(b, '.png'), 10)
      return numA - numB
    })

  console.log(`Found ${screenshots.length} screenshots`)

  const firstMeta = await sharp(join(screenshotsDir, screenshots[0])).metadata()
  console.log(`Screenshot dimensions: ${firstMeta.width} x ${firstMeta.height}`)
  console.log('')

  const actionByScreenshot = new Map<number, ActionInfo>()
  for (const action of actions) {
    actionByScreenshot.set(action.screenshotNum, action)
  }

  console.log('Annotating screenshots...')
  for (const ss of screenshots) {
    const ssNum = parseInt(basename(ss, '.png'), 10)
    const inputPath = join(screenshotsDir, ss)
    const outputPath = join(annotatedDir, `${ssNum}_annotated.png`)
    const action = actionByScreenshot.get(ssNum) || null

    if (action) {
      console.log(`  ${ss} → annotated (${action.toolName})`)
    } else {
      console.log(`  ${ss} → copied (no coordinates)`)
    }

    await annotateScreenshot(inputPath, outputPath, action, dpr)
  }

  console.log('')
  console.log(`Done! Annotated screenshots saved to: ${annotatedDir}`)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
