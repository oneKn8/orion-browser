/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'

import { ActionHandler } from '../ActionHandler'

// Input schema - no input needed
const CheckOrionInputSchema = z.any()

// Output schema
const CheckOrionOutputSchema = z.object({
  available: z.boolean(),
  apis: z.array(z.string()).optional(),
  error: z.string().optional(),
})

type CheckOrionInput = z.infer<typeof CheckOrionInputSchema>
type CheckOrionOutput = z.infer<typeof CheckOrionOutputSchema>

/**
 * CheckOrionAction - Diagnostic action to check if chrome.browserOS is available
 *
 * This action checks:
 * 1. Whether chrome.browserOS namespace exists
 * 2. What APIs are available in the namespace
 * 3. Returns detailed diagnostic information
 */
export class CheckOrionAction extends ActionHandler<
  CheckOrionInput,
  CheckOrionOutput
> {
  readonly inputSchema = CheckOrionInputSchema

  async execute(_input: CheckOrionInput): Promise<CheckOrionOutput> {
    try {
      console.log('[CheckOrionAction] Starting diagnostic...')
      console.log('[CheckOrionAction] typeof chrome:', typeof chrome)
      console.log('[CheckOrionAction] chrome exists:', chrome !== undefined)

      // Check if chrome.browserOS exists
      const orionExists = typeof chrome.browserOS !== 'undefined'
      console.log(
        '[CheckOrionAction] typeof chrome.browserOS:',
        typeof chrome.browserOS,
      )
      console.log('[CheckOrionAction] orionExists:', orionExists)

      if (!orionExists) {
        console.log('[CheckOrionAction] chrome.browserOS is NOT available')
        return {
          available: false,
          error:
            'chrome.browserOS is undefined - not running in Orion Chrome',
        }
      }

      // Get available APIs
      const apis: string[] = []
      const orionApi = chrome.browserOS as Record<string, unknown>

      for (const key in orionApi) {
        if (typeof orionApi[key] === 'function') {
          apis.push(key)
        }
      }

      console.log('[CheckOrionAction] Found APIs:', apis)

      return {
        available: true,
        apis: apis.sort(),
      }
    } catch (error) {
      console.error('[CheckOrionAction] Error during diagnostic:', error)
      const errorMsg =
        error instanceof Error
          ? error.message
          : error
            ? String(error)
            : 'Unknown error'
      return {
        available: false,
        error: errorMsg,
      }
    }
  }
}
