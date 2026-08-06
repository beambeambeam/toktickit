import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      gcTime: 600_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: 2,
      staleTime: 60_000,
    },
  },
});
