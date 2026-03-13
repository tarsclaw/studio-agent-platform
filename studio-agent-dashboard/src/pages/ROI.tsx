import { motion } from 'framer-motion';
import { Clock, MessageSquare, PiggyBank, PoundSterling, TrendingUp, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useSummary } from '../hooks/useSummary';
import { useTools } from '../hooks/useTools';
import { useTrends } from '../hooks/useTrends';
import { AreaChart } from '../components/charts/AreaChart';
import { ChartCard } from '../components/charts/ChartCard';
import { TrendBar } from '../components/charts/TrendBar';
import { MetricCard } from '../components/cards/MetricCard';
import { MetricGrid } from '../components/cards/MetricGrid';
import { ToolROITable } from '../components/tables/ToolROITable';
import { ErrorState } from '../components/shared/ErrorState';
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatHours,
  formatMonthShort,
  formatNumber,
} from '../lib/formatters';
import { MONTHLY_PLATFORM_COST } from '../lib/constants';
import { usePeriod } from '../hooks/usePeriod';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function daysInPeriod(period: string) {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function ROI() {
  const { period } = usePeriod();
  const summaryQuery = useSummary();
  const trendsQuery = useTrends();
  const toolsQuery = useTools();

  if (summaryQuery.isError || trendsQuery.isError || toolsQuery.isError) {
    return <ErrorState onRetry={() => void Promise.all([summaryQuery.refetch(), trendsQuery.refetch(), toolsQuery.refetch()])} />;
  }

  const metrics = summaryQuery.data?.hero_metrics;
  const trends = trendsQuery.data?.days ?? [];
  const tools = toolsQuery.data?.tools ?? [];

  const periodDays = daysInPeriod(period);
  const avgCostPerDay = (metrics?.cost_saved ?? 0) / periodDays;
  const avgHoursPerDay = (metrics?.hours_saved ?? 0) / periodDays;
  const costPerConversation = MONTHLY_PLATFORM_COST / Math.max(1, metrics?.total_conversations ?? 0);

  const monthlyGrouped = useMemo(() => {
    const map = new Map<string, { date: string; cost_saved: number; hours_saved: number }>();
    for (const day of trends) {
      const key = day.date.slice(0, 7);
      const existing = map.get(key) ?? { date: key, cost_saved: 0, hours_saved: 0 };
      existing.cost_saved += day.cost_saved;
      existing.hours_saved += day.hours_saved;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [trends]);

  const monthlyCostChart = monthlyGrouped.map((month) => ({
    ...month,
    date: formatMonthShort(month.date),
  }));

  const cumulativeData = useMemo(
    () =>
      trends.reduce((acc, day, i) => {
        const prev = i > 0 ? acc[i - 1].cumulative : 0;
        acc.push({ date: day.date, cumulative: prev + day.cost_saved });
        return acc;
      }, [] as { date: string; cumulative: number }[]),
    [trends],
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <MetricGrid columns={6}>
        <motion.div variants={item}>
          <MetricCard
            label="Total Cost Saved"
            icon={PoundSterling}
            value={formatCurrency(metrics?.cost_saved ?? 0)}
            accent
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Total Hours Saved"
            icon={Clock}
            value={`${formatHours(metrics?.hours_saved ?? 0)} hrs`}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Avg Cost Saved / Day"
            icon={PiggyBank}
            value={formatCurrency(Math.round(avgCostPerDay))}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Avg Hours / Day"
            icon={TrendingUp}
            value={`${formatHours(avgHoursPerDay)} hrs`}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Projected Annual Savings"
            icon={Wallet}
            value={formatCurrency(metrics?.projected_annual_savings ?? 0)}
            accent
            loading={summaryQuery.isLoading}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Cost Per Conversation"
            icon={MessageSquare}
            value={formatCurrencyPrecise(costPerConversation)}
            loading={summaryQuery.isLoading}
          />
        </motion.div>
      </MetricGrid>

      <motion.div variants={item} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Monthly Cost Saved" loading={trendsQuery.isLoading}>
          <TrendBar data={monthlyCostChart} dataKey="cost_saved" formatter={formatCurrency} />
        </ChartCard>
        <ChartCard title="Monthly Hours Saved" loading={trendsQuery.isLoading}>
          <TrendBar
            data={monthlyCostChart}
            dataKey="hours_saved"
            fill="var(--brand-secondary)"
            formatter={(v) => `${formatHours(v)}h`}
          />
        </ChartCard>
      </motion.div>

      <motion.div variants={item}>
        <ChartCard title="Cumulative Savings Over Time" loading={trendsQuery.isLoading}>
          <AreaChart data={cumulativeData} dataKey="cumulative" formatter={formatCurrency} height={320} />
        </ChartCard>
      </motion.div>

      <motion.div variants={item}>
        <ToolROITable tools={tools} />
      </motion.div>
    </motion.div>
  );
}
