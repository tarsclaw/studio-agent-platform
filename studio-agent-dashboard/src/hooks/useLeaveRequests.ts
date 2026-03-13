import { useQuery } from '@tanstack/react-query';
import { hubApi } from '../api/hubApi';

export function useLeaveRequests(params?: { status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['leave-requests', params?.status ?? 'all', params?.limit ?? 50],
    queryFn: () => hubApi.leaveRequests(params),
    staleTime: 2 * 60 * 1000,
  });
}
