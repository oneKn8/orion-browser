/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import {
  OrionAdapter,
  type PageLoadStatus,
} from '@/adapters/OrionAdapter'
import { ActionHandler } from '../ActionHandler'

// Input schema for getPageLoadStatus action
const GetPageLoadStatusInputSchema = z.object({
  tabId: z
    .number()
    .int()
    .positive()
    .describe('Tab ID to check page load status'),
})

type GetPageLoadStatusInput = z.infer<typeof GetPageLoadStatusInputSchema>

// Output includes page load status details
export interface GetPageLoadStatusOutput {
  tabId: number
  isResourcesLoading: boolean
  isDOMContentLoaded: boolean
  isPageComplete: boolean
}

/**
 * GetPageLoadStatusAction - Get page loading status for a tab
 *
 * Returns the current page load status including:
 * - isResourcesLoading: Whether resources (images, scripts, etc.) are still loading
 * - isDOMContentLoaded: Whether the DOM is fully parsed and ready
 * - isPageComplete: Whether the page has completely finished loading
 *
 * Useful for waiting for pages to load before taking actions.
 *
 * Example payload:
 * {
 *   "tabId": 123
 * }
 */
export class GetPageLoadStatusAction extends ActionHandler<
  GetPageLoadStatusInput,
  GetPageLoadStatusOutput
> {
  readonly inputSchema = GetPageLoadStatusInputSchema
  private orionAdapter = OrionAdapter.getInstance()

  async execute(
    input: GetPageLoadStatusInput,
  ): Promise<GetPageLoadStatusOutput> {
    const { tabId } = input

    const status: PageLoadStatus =
      await this.orionAdapter.getPageLoadStatus(tabId)

    return {
      tabId,
      isResourcesLoading: status.isResourcesLoading,
      isDOMContentLoaded: status.isDOMContentLoaded,
      isPageComplete: status.isPageComplete,
    }
  }
}
