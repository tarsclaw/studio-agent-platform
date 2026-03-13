import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from 'react';

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface PeriodContextType {
  period: string;
  setPeriod: (period: string) => void;
}

const PeriodContext = createContext<PeriodContextType>({
  period: getCurrentMonth(),
  setPeriod: () => {},
});

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<string>(getCurrentMonth());

  const value = useMemo(() => ({ period, setPeriod }), [period]);
  return createElement(PeriodContext.Provider, { value }, children);
}

export function usePeriod() {
  return useContext(PeriodContext);
}
