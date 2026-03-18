/**
 * @public
 */
export interface OrionSuggestion {
  mode: 'chat' | 'agent'
  message: string
}

/**
 * @public
 */
export const useOrionSuggestions = ({
  query,
}: {
  query: string
}): OrionSuggestion[] => {
  return [
    {
      mode: 'agent',
      message: query,
    },
  ]
}
