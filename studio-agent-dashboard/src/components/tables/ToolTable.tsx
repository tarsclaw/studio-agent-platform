import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ToolsResponse, TrendsResponse } from '../../api/types';
import { CategoryBadge } from '../shared/CategoryBadge';
import { CustomTooltip } from '../charts/CustomTooltip';
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatHours,
  formatNumber,
  formatToolName,
  formatTooltipLabel,
} from '../../lib/formatters';

type ToolRow = ToolsResponse['tools'][number];
type SortKey =
  | 'tool'
  | 'category'
  | 'executions'
  | 'baseline_minutes_per'
  | 'total_minutes_saved'
  | 'hours_saved'
  | 'cost_saved';

export function ToolTable({ tools, trends }: { tools: ToolRow[]; trends: TrendsResponse['days'] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'executions',
    dir: 'desc',
  });
  const [expanded, setExpanded] = useState<string | null>(null);

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
  }, [sort, tools]);

  const sortIcon = (key: SortKey) => {
    if (sort.key !== key) return <ChevronDown size={14} className="opacity-40" />;
    return sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const getMiniData = (tool: string) =>
    trends.map((day) => ({
      date: day.date,
      count: day.tool_counts?.[tool] ?? 0,
    }));

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-[var(--border-primary)] px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        Full Tool Breakdown
      </div>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--bg-tertiary)] text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
            <tr>
              {[
                ['tool', 'Tool Name'],
                ['category', 'Category'],
                ['executions', 'Executions'],
                ['baseline_minutes_per', 'Mins Saved/Use'],
                ['total_minutes_saved', 'Total Mins'],
                ['hours_saved', 'Hours Saved'],
                ['cost_saved', 'Cost Saved'],
              ].map(([key, label]) => (
                <th key={key} className="px-4 py-3 text-left font-semibold">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 text-left"
                    onClick={() => toggleSort(key as SortKey)}
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
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                  No tool execution data available for this period.
                </td>
              </tr>
            ) : (
              sorted.map((tool) => {
                const isExpanded = expanded === tool.tool;
                const miniData = getMiniData(tool.tool);

                return (
                  <Fragment key={tool.tool}>
                    <tr
                      className="cursor-pointer border-t border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]"
                      onClick={() => setExpanded(isExpanded ? null : tool.tool)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setExpanded(isExpanded ? null : tool.tool);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{formatToolName(tool.tool)}</td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={tool.category} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatNumber(tool.executions)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatNumber(tool.baseline_minutes_per)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatNumber(tool.total_minutes_saved)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{formatHours(tool.hours_saved)}</td>
                      <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{formatCurrency(tool.cost_saved)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
                            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                              Daily Executions (Last 30 Days)
                            </div>
                            <ResponsiveContainer width="100%" height={160}>
                              <BarChart data={miniData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                <XAxis
                                  dataKey="date"
                                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                                  tickFormatter={formatTooltipLabel}
                                  interval={4}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis
                                  tick={{ fontSize: 11, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }}
                                  tickLine={false}
                                  axisLine={false}
                                  width={42}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                            <p className="mt-3 text-sm text-[var(--text-secondary)]">
                              This tool saves {formatNumber(tool.baseline_minutes_per)} minutes per use. Used{' '}
                              {formatNumber(tool.executions)} times this month, saving {formatHours(tool.hours_saved)}
                              {' '}hours ({formatCurrencyPrecise(tool.cost_saved)}).
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--border-primary)] px-6 py-3 text-sm text-[var(--text-secondary)]">
        Showing {sorted.length} tools
      </div>
    </section>
  );
}
