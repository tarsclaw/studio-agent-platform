import { Calendar, ChevronDown } from 'lucide-react';
import { useMemo } from 'react';
import { usePeriod } from '../../hooks/usePeriod';
import { formatMonth } from '../../lib/formatters';

function recentMonths(count = 6): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }
  return months;
}

export function PeriodSelector() {
  const { period, setPeriod } = usePeriod();
  const options = useMemo(() => recentMonths(6), []);

  return (
    <label className="relative inline-flex items-center gap-2 rounded-md border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2 pr-8 text-sm font-medium text-[var(--text-primary)]">
      <Calendar size={16} />
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-4 text-sm outline-none"
        aria-label="Select reporting period"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatMonth(option)}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 text-[var(--text-tertiary)]" />
    </label>
  );
}
