import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Gauge, Timer } from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSummary } from '../hooks/useSummary';
import { useTrends } from '../hooks/useTrends';
import { MetricCard } from '../components/cards/MetricCard';
import { MetricGrid } from '../components/cards/MetricGrid';
import { ChartCard } from '../components/charts/ChartCard';
import { CustomTooltip } from '../components/charts/CustomTooltip';
import { EmptyState } from '../components/shared/EmptyState';
import { ErrorState } from '../components/shared/ErrorState';
import { formatLatency, formatPercent, formatTooltipLabel } from '../lib/formatters';

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

export function Performance() {
  const { from, to } = useMemo(getLast30DaysRange, []);
  const summaryQuery = useSummary();
  const trendsQuery = useTrends(from, to);

  if (summaryQuery.isError || trendsQuery.isError) {
    return <ErrorState onRetry={() => void Promise.all([summaryQuery.refetch(), trendsQuery.refetch()])} />;
  }

  const metrics = summaryQuery.data?.hero_metrics;
  const trends = trendsQuery.data?.days ?? [];
  const explicitHasTurnData = summaryQuery.data?.has_turn_data;

  const inferredTurnData = trends.some((d) => d.success_count > 0 || d.error_count > 0 || d.empty_reply_count > 0);
  const hasTurnData = explicitHasTurnData ?? inferredTurnData;

  const latencyAvailable =
    hasTurnData && ((metrics?.avg_latency_ms ?? 0) > 0 || trends.some((d) => d.avg_latency_ms > 0 || d.p95_latency_ms > 0));

  const rateAvailable =
    hasTurnData &&
    ((metrics?.total_conversations ?? 0) > 0 ||
      (metrics?.self_service_rate ?? 0) > 0 ||
      (metrics?.error_rate ?? 0) > 0 ||
      inferredTurnData);

  const latencyTrends = trends.map((day) => ({
    ...day,
    avg_latency_s: Number((day.avg_latency_ms / 1000).toFixed(2)),
    p95_latency_s: Number((day.p95_latency_ms / 1000).toFixed(2)),
    success_rate_pct: Number((day.success_rate * 100).toFixed(1)),
  }));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <MetricGrid columns={4}>
        <motion.div variants={item}>
          <MetricCard
            label="Avg Response Time"
            icon={Timer}
            value={formatLatency(metrics?.avg_latency_ms ?? 0)}
            loading={summaryQuery.isLoading}
            empty={!latencyAvailable}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="P95 Response Time"
            icon={Gauge}
            value={formatLatency(metrics?.p95_latency_ms ?? 0)}
            loading={summaryQuery.isLoading}
            empty={!latencyAvailable}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Success Rate"
            icon={CheckCircle}
            value={formatPercent(metrics?.self_service_rate ?? 0)}
            loading={summaryQuery.isLoading}
            empty={!rateAvailable}
          />
        </motion.div>
        <motion.div variants={item}>
          <MetricCard
            label="Error Rate"
            icon={AlertTriangle}
            value={formatPercent(metrics?.error_rate ?? 0)}
            loading={summaryQuery.isLoading}
            empty={!rateAvailable}
          />
        </motion.div>
      </MetricGrid>

      {!hasTurnData && (
        <motion.div variants={item}>
          <EmptyState body="Performance metrics will populate once turn_completed events are flowing." />
        </motion.div>
      )}

      <motion.div variants={item} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Average Response Time"
          loading={trendsQuery.isLoading}
          empty={!latencyAvailable}
          emptyMessage="Latency data is not available yet."
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={latencyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                tickFormatter={formatTooltipLabel}
                interval={4}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="avg_latency_s" stroke="var(--brand-secondary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="P95 Response Time"
          loading={trendsQuery.isLoading}
          empty={!latencyAvailable}
          emptyMessage="Latency data is not available yet."
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={latencyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                tickFormatter={formatTooltipLabel}
                interval={4}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="p95_latency_s" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Success Rate Over Time"
          loading={trendsQuery.isLoading}
          empty={!rateAvailable}
          emptyMessage="Success/error rate data is not available yet."
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={latencyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                tickFormatter={formatTooltipLabel}
                interval={4}
                tickLine={false}
                axisLine={false}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={50} />
              <Tooltip content={<CustomTooltip formatter={(value) => `${value}%`} />} />
              <ReferenceLine y={95} stroke="var(--color-warning)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="success_rate_pct" stroke="var(--brand-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Error Breakdown"
          loading={trendsQuery.isLoading}
          empty={!rateAvailable}
          emptyMessage="Success/error rate data is not available yet."
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                tickFormatter={formatTooltipLabel}
                interval={4}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="success_count" stackId="a" fill="var(--brand-primary)" name="Success" />
              <Bar dataKey="error_count" stackId="a" fill="var(--color-error)" name="Error" />
              <Bar dataKey="empty_reply_count" stackId="a" fill="var(--color-warning)" name="Empty" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </motion.div>
    </motion.div>
  );
}
