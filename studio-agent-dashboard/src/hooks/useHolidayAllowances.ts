import { useQuery } from '@tanstack/react-query';
import { hubApi } from '../api/hubApi';

export function useHolidayAllowances() {
  return useQuery({
    queryKey: ['holiday-allowances'],
    queryFn: () => hubApi.holidayAllowances(),
    staleTime: 5 * 60 * 1000,
  });
}
