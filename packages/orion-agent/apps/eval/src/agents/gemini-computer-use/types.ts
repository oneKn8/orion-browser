/**
 * Types for Gemini Computer Use agent
 */

import { z } from 'zod'

// Gemini Computer Use predefined actions (from API docs)
export const ComputerUseActionSchema = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('click_at'),
    args: z.object({
      x: z.number().min(0).max(999),
      y: z.number().min(0).max(999),
    }),
  }),
  z.object({
    name: z.literal('type_text_at'),
    args: z.object({
      x: z.number().min(0).max(999),
      y: z.number().min(0).max(999),
      text: z.string(),
      press_enter: z.boolean().optional(),
      clear_before_typing: z.boolean().optional(),
    }),
  }),
  z.object({
    name: z.literal('navigate'),
    args: z.object({
      url: z.string(),
    }),
  }),
  z.object({
    name: z.literal('scroll_document'),
    args: z.object({
      direction: z.enum(['up', 'down', 'left', 'right']),
    }),
  }),
  z.object({
    name: z.literal('scroll_at'),
    args: z.object({
      x: z.number().min(0).max(999),
      y: z.number().min(0).max(999),
      direction: z.enum(['up', 'down', 'left', 'right']),
      magnitude: z.number().optional(),
    }),
  }),
  z.object({
    name: z.literal('key_combination'),
    args: z.object({
      keys: z.string(),
    }),
  }),
  z.object({
    name: z.literal('hover_at'),
    args: z.object({
      x: z.number().min(0).max(999),
      y: z.number().min(0).max(999),
    }),
  }),
  z.object({
    name: z.literal('go_back'),
    args: z.object({}).optional(),
  }),
  z.object({
    name: z.literal('go_forward'),
    args: z.object({}).optional(),
  }),
  z.object({
    name: z.literal('wait_5_seconds'),
    args: z.object({}).optional(),
  }),
  z.object({
    name: z.literal('drag_and_drop'),
    args: z.object({
      x: z.number().min(0).max(999),
      y: z.number().min(0).max(999),
      destination_x: z.number().min(0).max(999),
      destination_y: z.number().min(0).max(999),
    }),
  }),
])

export type ComputerUseAction = z.infer<typeof ComputerUseActionSchema>

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

// Gemini API types
export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
  functionCall?: {
    name: string
    args?: Record<string, unknown>
  }
  functionResponse?: {
    name: string
    response: Record<string, unknown>
  }
}

export interface GeminiResponse {
  candidates?: Array<{
    content: GeminiContent
    finishReason?: string
  }>
  error?: {
    message: string
    code: number
  }
}

// Safety decision from Computer Use
export interface SafetyDecision {
  decision: 'allow' | 'require_confirmation' | 'block'
  explanation?: string
}

// Agent configuration
export interface GeminiComputerUseAgentConfig {
  apiKey: string
  turnLimit: number
  screenSize: ScreenSize
  tabId: number
  windowId: number
  mcpUrl: string
}

// Defaults
export const DEFAULTS = {
  // Gemini's recommended screenshot size for optimal model accuracy
  screenshotSize: { width: 1440, height: 900 },
  // Fallback viewport size (used when actual viewport can't be determined)
  screenSize: { width: 1440, height: 900 },
  turnLimit: 30,
  model: 'gemini-2.5-computer-use-preview-10-2025',
} as const
