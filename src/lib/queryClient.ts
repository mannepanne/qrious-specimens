// ABOUT: TanStack React Query client configuration
// ABOUT: Shared instance used across all data-fetching hooks
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes — re-fetch in background after this
      gcTime: 1000 * 60 * 30,    // 30 minutes — keep inactive data in cache (creature data changes rarely)
      retry: 1,
    },
  },
})
