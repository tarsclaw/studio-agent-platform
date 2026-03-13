import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { useSummary } from '../hooks/useSummary';
import { useTrends } from '../hooks/useTrends';
import { ChartCard } from '../components/charts/ChartCard';
import { StackedBar } from '../components/charts/StackedBar';
import { ErrorState } from '../components/shared/ErrorState';
import { formatCurrency, formatHours, formatNumber } from '../lib/formatters';

function getLast30DaysRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function BotComparison() {
  const { from, to } = useMemo(getLast30DaysRange, []);
  const summaryQuery = useSummary();
  const trendsQuery = useTrends(from, to);

  if (summaryQuery.isError || trendsQuery.isError) {
    return <ErrorState onRetry={() => void Promise.all([summaryQuery.refetch(), trendsQuery.refetch()])} />;
  }

  const metrics = summaryQuery.data?.hero_metrics;
  const trends = trendsQuery.data?.days ?? [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="card border-t-[3px] border-t-[var(--brand-secondary)] p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Employee Bot</div>
          <div className="mt-4 flex items-center gap-3">
            <MessageSquare size={20} color="var(--brand-secondary)" />
            <div>
              <div className="text-sm text-[var(--text-secondary)]">Conversations</div>
              <div className="font-mono text-3xl font-bold text-[var(--text-primary)]">
                {formatNumber(metrics?.employee_turns ?? 0)}
              </div>
            </div>
          </div>
        </article>

        <article className="card border-t-[3px] border-t-[var(--chart-3)] p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Admin Bot</div>
          <div className="mt-4 flex items-center gap-3">
            <MessageSquare size={20} color="var(--chart-3)" />
            <div>
              <div className="text-sm text-[var(--text-secondary)]">Conversations</div>
              <div className="font-mono text-3xl font-bold text-[var(--text-primary)]">
                {formatNumber(metrics?.admin_turns ?? 0)}
              </div>
            </div>
          </div>
        </article>
      </motion.div>

      <motion.section variants={item} className="card p-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Combined Totals</div>
        <div className="mt-3 text-sm text-[var(--text-secondary)]">
          Total Hours Saved: {formatHours(metrics?.hours_saved ?? 0)} &nbsp; | &nbsp; Total Cost Saved:{' '}
          {formatCurrency(metrics?.cost_saved ?? 0)}
        </div>
        <p className="mt-2 text-xs italic text-[var(--text-tertiary)]">
          Per-bot cost breakdown coming in a future update.
        </p>
      </motion.section>

      <motion.div variants={item}>
        <ChartCard title="Bot Usage Over Time" loading={trendsQuery.isLoading}>
          <StackedBar data={trends.map((d) => ({ date: d.date, employee_turns: d.employee_turns, admin_turns: d.admin_turns }))} />
        </ChartCard>
      </motion.div>
    </motion.div>
  );
}
