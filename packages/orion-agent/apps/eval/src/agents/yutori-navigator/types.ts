/**
 * Types for Yutori Navigator n1 agent
 *
 * n1 is a pixels-to-actions LLM that follows OpenAI Chat Completions interface.
 * Coordinates are normalized to 1000x1000 grid.
 * Recommended screenshot size: 1280x800 (WXGA 16:10)
 */

import { z } from 'zod'

// n1 action schemas based on API documentation
export const N1ActionSchema = z.discriminatedUnion('action_type', [
  z.object({
    action_type: z.literal('click'),
    center_coordinates: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    action_type: z.literal('scroll'),
    direction: z.enum(['up', 'down', 'left', 'right']),
    center_coordinates: z.tuple([z.number(), z.number()]),
    amount: z.number().int().min(1).max(10),
  }),
  z.object({
    action_type: z.literal('type'),
    text: z.string(),
    press_enter_after: z.boolean().optional(),
    clear_before_typing: z.boolean().optional(),
  }),
  z.object({
    action_type: z.literal('key_press'),
    key_comb: z.string(), // Playwright keyboard press format
  }),
  z.object({
    action_type: z.literal('hover'),
    center_coordinates: z.tuple([z.number(), z.number()]),
  }),
  z.object({
    action_type: z.literal('drag'),
    start_coordinates: z.tuple([z.number(), z.number()]),
    center_coordinates: z.tuple([z.number(), z.number()]), // destination
  }),
  z.object({
    action_type: z.literal('wait'),
  }),
  z.object({
    action_type: z.literal('refresh'),
  }),
  z.object({
    action_type: z.literal('go_back'),
  }),
  z.object({
    action_type: z.literal('goto_url'),
    url: z.string(),
  }),
  z.object({
    action_type: z.literal('read_texts_and_links'),
  }),
  z.object({
    action_type: z.literal('stop'),
    answer: z.string(),
  }),
])

export type N1Action = z.infer<typeof N1ActionSchema>

// n1 API response format
export const N1ResponseSchema = z.object({
  thoughts: z.string(),
  actions: z.array(N1ActionSchema),
})

export type N1Response = z.infer<typeof N1ResponseSchema>

// Screen size configuration
export interface ScreenSize {
  width: number
  height: number
}

// Context for action execution
export interface ActionContext {
  mcpUrl: string
  tabId: number
  windowId: number
  screenSize: ScreenSize
}

// OpenAI-compatible message types for n1 API
export type N1MessageRole = 'user' | 'assistant' | 'observation'

export interface N1TextContent {
  type: 'text'
  text: string
}

export interface N1ImageContent {
  type: 'image_url'
  image_url: {
    url: string // Can be URL or data:image/webp;base64,...
  }
}

export type N1ContentPart = N1TextContent | N1ImageContent

export interface N1Message {
  role: N1MessageRole
  content: string | N1ContentPart[]
}

export interface N1ChatCompletionRequest {
  model: string
  messages: N1Message[]
  temperature?: number
}

export interface N1ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string // JSON string containing N1Response
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Agent configuration
export interface YutoriNavigatorAgentConfig {
  apiKey: string
  turnLimit: number
  screenSize: ScreenSize
  tabId: number
  windowId: number
  mcpUrl: string
}

// Defaults based on Yutori documentation
export const DEFAULTS = {
  // WXGA 16:10 - Yutori's recommended screenshot size
  screenshotSize: { width: 1280, height: 800 },
  screenSize: { width: 1280, height: 800 },
  turnLimit: 30,
  model: 'n1-preview-2025-11',
  temperature: 0.3,
  // n1 uses 1000x1000 normalized coordinate system
  normalizedMax: 1000,
} as const

export const YUTORI_API_BASE = 'https://api.yutori.com/v1'
