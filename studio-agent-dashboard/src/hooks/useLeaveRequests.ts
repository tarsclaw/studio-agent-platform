import { useQuery } from '@tanstack/react-query';
import { hubApi } from '../api/hubApi';

export function useLeaveRequests(params?: { status?: string; limit?: number }, token?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['leave-requests', params?.status ?? 'all', params?.limit ?? 50],
    queryFn: () => hubApi.leaveRequests(params, token),
    staleTime: 2 * 60 * 1000,
    enabled: enabled && Boolean(token),
  });
}
