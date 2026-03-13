import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  MessageSquare,
  PoundSterling,
  Users,
  Wrench,
} from 'lucide-react';
import { useMemo } from 'react';
import { useSummary } from '../hooks/useSummary';
import { useTools } from '../hooks/useTools';
import { useTrends } from '../hooks/useTrends';
import { ChartCard } from '../components/charts/ChartCard';
import { DonutChart } from '../components/charts/DonutChart';
import { TrendBar } from '../components/charts/TrendBar';
import { TrendLine } from '../components/charts/TrendLine';
import { EmptyState } from '../components/shared/EmptyState';
import { ErrorState } from '../components/shared/ErrorState';
import { MetricCard } from '../components/cards/MetricCard';
import { MetricGrid } from '../components/cards/MetricGrid';
import { AttendanceWidget } from '../components/attendance/AttendanceWidget';
import { HolidayAllowanceWidget } from '../components/attendance/HolidayAllowanceWidget';
import { formatCurrency, formatHours, formatNumber, formatPercent, formatToolName } from '../lib/formatters';

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

export function Overview() {
  const { from, to } = useMemo(getLast30DaysRange, []);
  const summaryQuery = useSummary();
  const trendsQuery = useTrends(from, to);
  const toolsQuery = useTools();

  if (summaryQuery.isError || trendsQuery.isError || toolsQuery.isError) {
    return <ErrorState onRetry={() => void Promise.all([summaryQuery.refetch(), trendsQuery.refetch(), toolsQuery.refetch()])} />;
  }

  const summary = summaryQuery.data;
  const trends = trendsQuery.data?.days ?? [];
  const metrics = summary?.hero_metrics;

  const employee = metrics?.employee_turns ?? 0;
  const admin = metrics?.admin_turns ?? 0;
  const successRate = metrics?.self_service_rate ?? 0;
  const errorRate = metrics?.error_rate ?? 0;
  const emptyRate = Math.max(0, 100 - successRate - errorRate);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <MetricGrid columns={6}>
        <motion.div variants={item}>
          <MetricCard
            label="Cost Saved"
            icon={PoundSterling}
            value={formatCurrency(metrics?.cost_saved ?? 0)}
            accent
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Hours Saved"
            icon={Clock}
            value={formatHours(metrics?.hours_saved ?? 0)}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Conversations"
            icon={MessageSquare}
            value={formatNumber(metrics?.total_conversations ?? 0)}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Tool Executions"
            icon={Wrench}
            value={formatNumber(metrics?.total_tool_executions ?? 0)}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Self-Service Rate"
            icon={CheckCircle}
            value={formatPercent(metrics?.self_service_rate ?? 0)}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Unique Users"
            icon={Users}
            value={formatNumber(metrics?.unique_users ?? 0)}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
      </MetricGrid>

      <motion.div variants={item} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Daily Conversations" loading={trendsQuery.isLoading}>
          <TrendLine data={trends} dataKey="total_turns" name="Conversations" formatter={formatNumber} />
        </ChartCard>
        <ChartCard title="Daily Cost Saved" loading={trendsQuery.isLoading}>
          <TrendBar data={trends} dataKey="cost_saved" name="Cost Saved" formatter={formatCurrency} />
        </ChartCard>

        <ChartCard title="Employee vs Admin Bot" loading={summaryQuery.isLoading}>
          <DonutChart
            data={[
              { name: 'Employee', value: employee, color: 'var(--brand-secondary)' },
              { name: 'Admin', value: admin, color: 'var(--chart-3)' },
            ]}
            centerValue={formatNumber(employee + admin)}
            centerLabel="Total Turns"
          />
        </ChartCard>

        <ChartCard title="Outcome Breakdown" loading={summaryQuery.isLoading}>
          <DonutChart
            data={[
              { name: 'Success', value: successRate, color: 'var(--brand-primary)' },
              { name: 'Error', value: errorRate, color: 'var(--color-error)' },
              { name: 'Empty', value: emptyRate, color: 'var(--color-warning)' },
            ]}
            centerValue={formatPercent(successRate)}
            centerLabel="Success Rate"
          />
        </ChartCard>
      </motion.div>

      <motion.div variants={item}>
        <AttendanceWidget />
      </motion.div>

      <motion.div variants={item}>
        <HolidayAllowanceWidget />
      </motion.div>

      <motion.section variants={item} className="card p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Top Tools This Month</h3>
        <div className="mt-6 space-y-3">
          {(summary?.top_tools ?? []).length === 0 && !summaryQuery.isLoading ? (
            <EmptyState
              title="No tool leaderboard data"
              body="Top tools will appear once tool execution events are available for this period."
            />
          ) : (
            (summary?.top_tools ?? []).slice(0, 5).map((tool, index, arr) => {
              const max = arr[0]?.count || 1;
              const width = `${Math.max(8, (tool.count / max) * 100)}%`;
              return (
                <div key={tool.tool} className="grid grid-cols-[24px_1fr_2fr_56px] items-center gap-3">
                  <span className="font-mono text-sm text-[var(--text-tertiary)]">{index + 1}.</span>
                  <span className="truncate text-sm text-[var(--text-primary)]">{formatToolName(tool.tool)}</span>
                  <div className="h-2 rounded-full bg-[var(--bg-tertiary)]">
                    <div className="h-2 rounded-full bg-[var(--brand-primary)]" style={{ width }} />
                  </div>
                  <span className="text-right font-mono text-sm text-[var(--text-secondary)]">{formatNumber(tool.count)}</span>
                </div>
              );
            })
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
