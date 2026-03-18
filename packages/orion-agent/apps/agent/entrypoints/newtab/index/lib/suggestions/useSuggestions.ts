import { useMemo } from 'react'
import { getProviderConfig } from '@/lib/search-provider/providers'
import { useSearchProvider } from '@/lib/search-provider/search-provider-storage'
import { useAITabSuggestions } from '../aiTabSuggestions/useAITabSuggestions'
import { useOrionSuggestions } from '../orionSuggestions/useOrionSuggestions'
import { useSearchSuggestions } from '../searchSuggestions/useSearchSuggestions'
import type {
  AITabSuggestionItem,
  OrionSuggestionItem,
  SearchSuggestionItem,
  SuggestionItem,
  SuggestionSection,
} from './types'

interface UseSuggestionsArgs {
  query: string
  selectedTabs: chrome.tabs.Tab[]
}

function buildSearchResults(
  query: string,
  searchResultsFromApi: string[] | undefined,
): string[] {
  const orderedResults = [query.trim(), ...(searchResultsFromApi ?? [])]
  const seen = new Set<string>()
  const dedupedResults: string[] = []

  for (const item of orderedResults) {
    const normalizedItem = item.trim()
    if (!normalizedItem) {
      continue
    }

    const suggestionKey = normalizedItem.toLowerCase()
    if (seen.has(suggestionKey)) {
      continue
    }

    seen.add(suggestionKey)
    dedupedResults.push(normalizedItem)
  }

  return dedupedResults
}

/**
 * @public
 */
export const useSuggestions = ({ query, selectedTabs }: UseSuggestionsArgs) => {
  const { provider } = useSearchProvider()
  const providerConfig = getProviderConfig(provider)
  const trimmedQuery = query.trim()
  const hasQuery = trimmedQuery.length > 0

  const { data: searchResultsFromAPI } = useSearchSuggestions({
    query,
    searchEngine: provider,
  })

  const searchResults: string[] = useMemo(() => {
    return buildSearchResults(query, searchResultsFromAPI)
  }, [searchResultsFromAPI, query])

  const aiTabResults = useAITabSuggestions({ selectedTabs, input: query })
  const orionResults = useOrionSuggestions({ query: trimmedQuery })

  const sections = useMemo(() => {
    const result: SuggestionSection[] = []

    if (hasQuery && orionResults.length > 0) {
      const orionItems: OrionSuggestionItem[] = orionResults.map(
        (item, index) => ({
          id: `orion-${index}`,
          type: 'orion' as const,
          mode: item.mode,
          message: item.message,
        }),
      )
      result.push({
        id: 'orion',
        // Removed title since orion result will only have 1 item
        title: '',
        items: orionItems,
      })
    }

    if (selectedTabs.length > 0 && aiTabResults.length > 0) {
      const aiItems: AITabSuggestionItem[] = aiTabResults.map(
        (item, index) => ({
          id: `ai-tab-${index}`,
          type: 'ai-tab' as const,
          name: item.name,
          icon: item.icon,
          description: item.description,
          minTabs: item.minTabs,
          maxTabs: item.maxTabs,
        }),
      )
      result.push({
        id: 'ai-actions',
        title: 'AI Actions',
        items: aiItems,
      })
    } else if (hasQuery && searchResults.length > 0) {
      const searchItems: SearchSuggestionItem[] = searchResults.map(
        (item, index) => ({
          id: `search-${index}`,
          type: 'search' as const,
          query: item,
        }),
      )
      result.push({
        id: 'search',
        title: `${providerConfig.name} Search`,
        items: searchItems,
      })
    }

    return result
  }, [
    hasQuery,
    orionResults,
    selectedTabs.length,
    aiTabResults,
    searchResults,
    providerConfig.name,
  ])

  const flatItems = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  )

  return { sections, flatItems, providerConfig }
}

/**
 * @public
 */
export const getSuggestionLabel = (item: SuggestionItem): string => {
  switch (item.type) {
    case 'search':
      return item.query
    case 'ai-tab':
      return item.name
    case 'orion':
      return item.message
  }
}
