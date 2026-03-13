import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTooltipLabel } from '../../lib/formatters';
import { CustomTooltip } from './CustomTooltip';

interface StackedBarProps {
  data: Array<{ date: string; employee_turns: number; admin_turns: number }>;
}

export function StackedBar({ data }: StackedBarProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
          tickFormatter={formatTooltipLabel}
          interval={4}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="employee_turns" stackId="a" fill="var(--brand-secondary)" name="Employee Bot" />
        <Bar dataKey="admin_turns" stackId="a" fill="var(--chart-3)" name="Admin Bot" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
