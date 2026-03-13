import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatTooltipLabel } from '../../lib/formatters';
import { CustomTooltip } from './CustomTooltip';

interface TrendBarProps {
  data: Record<string, any>[];
  dataKey: string;
  name?: string;
  fill?: string;
  formatter?: (value: number) => string;
  height?: number;
}

export function TrendBar({
  data,
  dataKey,
  name,
  fill = 'var(--brand-primary)',
  formatter,
  height = 240,
}: TrendBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
          tickFormatter={formatTooltipLabel}
          interval={4}
          axisLine={{ stroke: 'var(--border-primary)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        <Bar dataKey={dataKey} name={name} fill={fill} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
