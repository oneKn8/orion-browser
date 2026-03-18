import type { LucideIcon } from 'lucide-react'

/**
 * @public
 */
export type SuggestionType = 'search' | 'ai-tab' | 'orion'

/**
 * @public
 */
interface BaseSuggestionItem {
  id: string
}

/**
 * @public
 */
export interface SearchSuggestionItem extends BaseSuggestionItem {
  type: 'search'
  query: string
}

/**
 * @public
 */
export interface AITabSuggestionItem extends BaseSuggestionItem {
  type: 'ai-tab'
  name: string
  icon: LucideIcon
  description: string
  minTabs: number
  maxTabs: number
}

/**
 * @public
 */
export interface OrionSuggestionItem extends BaseSuggestionItem {
  type: 'orion'
  mode: 'chat' | 'agent'
  message: string
}

/**
 * @public
 */
export type SuggestionItem =
  | SearchSuggestionItem
  | AITabSuggestionItem
  | OrionSuggestionItem

/**
 * @public
 */
export interface SuggestionSection<T extends SuggestionItem = SuggestionItem> {
  id: string
  title: string
  items: T[]
}
