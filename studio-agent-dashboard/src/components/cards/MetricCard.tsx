import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';

interface TrendData {
  direction: 'up' | 'down';
  label: string;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: boolean;
  loading?: boolean;
  empty?: boolean;
  trend?: TrendData;
}

export function MetricCard({ label, value, icon: Icon, accent, loading, empty, trend }: MetricCardProps) {
  if (loading) {
    return (
      <div className="metric-card">
        <LoadingSkeleton className="mb-4 h-4 w-2/3" />
        <LoadingSkeleton className="h-9 w-1/2" />
      </div>
    );
  }

  return (
    <article className={`metric-card ${accent ? 'metric-card-accent' : ''}`.trim()}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
        <Icon size={20} strokeWidth={1.75} color="var(--text-tertiary)" />
        <span>{label}</span>
      </div>

      <div
        className={`font-mono text-3xl font-bold ${accent ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'}`.trim()}
      >
        {empty ? '—' : value}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
          {trend.direction === 'up' ? (
            <TrendingUp size={12} color="var(--brand-primary)" />
          ) : (
            <TrendingDown size={12} color="var(--color-error)" />
          )}
          <span>{trend.label}</span>
        </div>
      )}
    </article>
  );
}
