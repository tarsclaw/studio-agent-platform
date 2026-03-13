import { motion } from 'framer-motion';
import { Activity, CalendarDays, MessageSquare, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useSummary } from '../hooks/useSummary';
import { useTrends } from '../hooks/useTrends';
import { useHourly } from '../hooks/useHourly';
import { useUsers } from '../hooks/useUsers';
import { useTools } from '../hooks/useTools';
import { MetricCard } from '../components/cards/MetricCard';
import { MetricGrid } from '../components/cards/MetricGrid';
import { ChartCard } from '../components/charts/ChartCard';
import { TrendLine } from '../components/charts/TrendLine';
import { TrendBar } from '../components/charts/TrendBar';
import { HeatmapBar } from '../components/charts/HeatmapBar';
import { EmptyState } from '../components/shared/EmptyState';
import { ErrorState } from '../components/shared/ErrorState';
import { formatHours, formatNumber } from '../lib/formatters';

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

export function Usage() {
  const { from, to } = useMemo(getLast30DaysRange, []);
  const summaryQuery = useSummary();
  const trendsQuery = useTrends(from, to);
  const hourlyQuery = useHourly();
  const usersQuery = useUsers();
  const toolsQuery = useTools();

  if (summaryQuery.isError || trendsQuery.isError || hourlyQuery.isError || usersQuery.isError || toolsQuery.isError) {
    return (
      <ErrorState
        onRetry={() =>
          void Promise.all([
            summaryQuery.refetch(),
            trendsQuery.refetch(),
            hourlyQuery.refetch(),
            usersQuery.refetch(),
            toolsQuery.refetch(),
          ])
        }
      />
    );
  }

  const metrics = summaryQuery.data?.hero_metrics;
  const trends = trendsQuery.data?.days ?? [];
  const hourly = hourlyQuery.data;
  const users = usersQuery.data;
  const categories = toolsQuery.data?.category_totals ?? [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <MetricGrid columns={4}>
        <motion.div variants={item}>
          <MetricCard
            label="Unique Users"
            icon={Users}
            value={formatNumber(metrics?.unique_users ?? 0)}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Conversations / User"
            icon={MessageSquare}
            value={(users?.avg_conversations_per_user ?? 0).toFixed(1)}
            loading={usersQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Peak Hour"
            icon={Activity}
            value={hourly?.peak_hour?.label ?? '—'}
            loading={hourlyQuery.isLoading}
            empty={!hourly?.peak_hour}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Busiest Day"
            icon={CalendarDays}
            value={hourly?.peak_day?.label ?? '—'}
            loading={hourlyQuery.isLoading}
            empty={!hourly?.peak_day}
          />
        </motion.div>
      </MetricGrid>

      <motion.div variants={item} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Daily Active Users" loading={trendsQuery.isLoading}>
          <TrendLine data={trends} dataKey="unique_users" name="Active Users" formatter={formatNumber} />
        </ChartCard>
        <ChartCard title="Conversations Per Day" loading={trendsQuery.isLoading}>
          <TrendBar data={trends} dataKey="total_turns" fill="var(--brand-secondary)" formatter={formatNumber} />
        </ChartCard>

        <ChartCard title="Usage by Hour of Day" loading={hourlyQuery.isLoading}>
          <HeatmapBar data={hourly?.by_hour ?? []} />
        </ChartCard>
        <ChartCard title="Usage by Day of Week" loading={hourlyQuery.isLoading}>
          <HeatmapBar data={hourly?.by_day_of_week ?? []} />
        </ChartCard>
      </motion.div>

      <motion.section variants={item}>
        {categories.length === 0 && !toolsQuery.isLoading ? (
          <EmptyState
            title="No category activity yet"
            body="Tool category usage cards will appear once events are captured for this period."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {categories.map((category) => (
              <article key={category.category} className="card p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{category.category}</div>
                <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">
                  {formatNumber(category.executions)} execs
                </div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">{formatHours(category.hours_saved)} hrs</div>
              </article>
            ))}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
