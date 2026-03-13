import { useQuery } from '@tanstack/react-query';
import { hubApi } from '../api/hubApi';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function useAttendance(date = todayDateString(), enabled = true) {
  return useQuery({
    queryKey: ['attendance', date],
    queryFn: () => hubApi.attendance(date),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled,
  });
}
