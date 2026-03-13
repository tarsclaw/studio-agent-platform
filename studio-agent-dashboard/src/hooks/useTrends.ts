import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useTrends(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: ['trends', from, to],
    queryFn: () => api.trends(from, to),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled,
    select: (data) => ({
      ...data,
      days: [...data.days].sort((a, b) => a.date.localeCompare(b.date)),
    }),
  });
}
