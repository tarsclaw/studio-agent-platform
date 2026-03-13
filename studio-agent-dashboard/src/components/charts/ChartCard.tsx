import type { ReactNode } from 'react';
import { EmptyState } from '../shared/EmptyState';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  className?: string;
  emptyMessage?: string;
}

export function ChartCard({ title, children, loading, empty, className = '', emptyMessage }: ChartCardProps) {
  return (
    <section className={`card p-6 ${className}`.trim()}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{title}</h3>
      <div className="pt-6">
        {loading ? (
          <LoadingSkeleton className="h-[240px] w-full" />
        ) : empty ? (
          <EmptyState body={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
