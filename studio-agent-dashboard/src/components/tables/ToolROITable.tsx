import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ToolsResponse } from '../../api/types';
import { CategoryBadge } from '../shared/CategoryBadge';
import { formatCurrency, formatHours, formatNumber, formatToolName } from '../../lib/formatters';

type ToolRow = ToolsResponse['tools'][number];
type SortKey = 'tool' | 'category' | 'executions' | 'baseline_minutes_per' | 'hours_saved' | 'cost_saved';

export function ToolROITable({ tools }: { tools: ToolRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'cost_saved',
    dir: 'desc',
  });

  const sorted = useMemo(() => {
    const rows = [...tools];
    rows.sort((a, b) => {
      const { key, dir } = sort;
      const av = a[key];
      const bv = b[key];
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [tools, sort]);

  const setSortKey = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortIcon = (key: SortKey) => {
    if (sort.key !== key) return <ChevronDown size={14} className="opacity-40" />;
    return sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-[var(--border-primary)] px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        Savings By Tool
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-[var(--bg-tertiary)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              {[
                ['tool', 'Tool'],
                ['category', 'Category'],
                ['executions', 'Executions'],
                ['baseline_minutes_per', 'Mins/Use'],
                ['hours_saved', 'Hours'],
                ['cost_saved', 'Cost'],
              ].map(([key, label]) => (
                <th key={key} className="px-4 py-3 text-left font-semibold">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 text-left"
                    onClick={() => setSortKey(key as SortKey)}
                  >
                    {label}
                    {sortIcon(key as SortKey)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr className="border-t border-[var(--border-subtle)]">
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                  No tool ROI data available for this period.
                </td>
              </tr>
            ) : (
              sorted.map((tool) => (
                <tr key={tool.tool} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{formatToolName(tool.tool)}</td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={tool.category} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatNumber(tool.executions)}</td>
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatNumber(tool.baseline_minutes_per)}</td>
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatHours(tool.hours_saved)}</td>
                  <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{formatCurrency(tool.cost_saved)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
