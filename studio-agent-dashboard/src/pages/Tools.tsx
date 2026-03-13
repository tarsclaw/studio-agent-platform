import { motion } from 'framer-motion';
import { Clock, PoundSterling, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { useTools } from '../hooks/useTools';
import { useTrends } from '../hooks/useTrends';
import { MetricCard } from '../components/cards/MetricCard';
import { MetricGrid } from '../components/cards/MetricGrid';
import { ToolTable } from '../components/tables/ToolTable';
import { EmptyState } from '../components/shared/EmptyState';
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

export function Tools() {
  const { from, to } = useMemo(getLast30DaysRange, []);
  const toolsQuery = useTools();
  const trendsQuery = useTrends(from, to);

  if (toolsQuery.isError || trendsQuery.isError) {
    return <ErrorState onRetry={() => void Promise.all([toolsQuery.refetch(), trendsQuery.refetch()])} />;
  }

  const toolsData = toolsQuery.data;
  const categoryTotals = toolsData?.category_totals ?? [];
  const trends = trendsQuery.data?.days ?? [];

  const categoryCards = categoryTotals.map((category) => ({
    category: category.category,
    executions: formatNumber(category.executions),
    hours: formatHours(category.hours_saved),
    cost: formatCurrency(category.cost_saved),
  }));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {categoryCards.length === 0 && !toolsQuery.isLoading ? (
        <motion.div variants={item}>
          <EmptyState
            title="No tool category data yet"
            body="Category summaries will appear once tool executions are tracked for this period."
          />
        </motion.div>
      ) : (
        <MetricGrid columns={4}>
          {categoryCards.map((card) => (
            <motion.div variants={item} key={card.category}>
              <MetricCard
                label={card.category.toUpperCase()}
                icon={Wrench}
                value={`${card.executions} execs`}
                loading={toolsQuery.isLoading}
              />
              <div className="mt-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <Clock size={14} /> {card.hours} hrs saved
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <PoundSterling size={14} /> {card.cost} saved
                </div>
              </div>
            </motion.div>
          ))}
        </MetricGrid>
      )}

      <motion.div variants={item}>
        <ToolTable tools={toolsData?.tools ?? []} trends={trends} />
      </motion.div>
    </motion.div>
  );
}
