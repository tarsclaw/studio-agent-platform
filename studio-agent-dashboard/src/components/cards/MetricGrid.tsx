import type { ReactNode } from 'react';

interface MetricGridProps {
  children: ReactNode;
  columns?: 4 | 6;
}

export function MetricGrid({ children, columns = 6 }: MetricGridProps) {
  return (
    <section
      className={`grid gap-4 ${
        columns === 6
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
      }`}
    >
      {children}
    </section>
  );
}
