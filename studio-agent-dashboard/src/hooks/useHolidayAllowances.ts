import { useQuery } from '@tanstack/react-query';
import { hubApi } from '../api/hubApi';

export function useHolidayAllowances(token?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['holiday-allowances'],
    queryFn: () => hubApi.holidayAllowances(token),
    staleTime: 5 * 60 * 1000,
    enabled: enabled && Boolean(token),
  });
}
