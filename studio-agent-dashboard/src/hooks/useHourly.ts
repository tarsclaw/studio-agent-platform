import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { usePeriod } from './usePeriod';

export function useHourly(enabled = true) {
  const { period } = usePeriod();

  return useQuery({
    queryKey: ['hourly', period],
    queryFn: () => api.hourly(period),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled,
  });
}
