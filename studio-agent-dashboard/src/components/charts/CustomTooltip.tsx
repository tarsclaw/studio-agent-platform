import { formatTooltipLabel } from '../../lib/formatters';

interface TooltipPayload {
  name: string;
  value: number | string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  formatter?: (value: number) => string;
}

export function CustomTooltip({ active, payload, label, formatter }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3 shadow-[var(--shadow-lg)]">
      {label !== undefined && <div className="mb-2 text-xs font-medium text-[var(--text-tertiary)]">{formatTooltipLabel(String(label))}</div>}
      <div className="space-y-1">
        {payload.map((entry) => {
          const value = typeof entry.value === 'number' && formatter ? formatter(entry.value) : entry.value;
          return (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || 'var(--brand-secondary)' }} />
                {entry.name}
              </div>
              <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
