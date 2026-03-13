import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTooltipLabel } from '../../lib/formatters';
import { CustomTooltip } from './CustomTooltip';

interface TrendLineProps {
  data: Record<string, any>[];
  dataKey: string;
  name?: string;
  stroke?: string;
  formatter?: (value: number) => string;
  yDomain?: [number, number];
  referenceLineAt?: number;
}

export function TrendLine({
  data,
  dataKey,
  name,
  stroke = 'var(--brand-secondary)',
  formatter,
  yDomain,
}: TrendLineProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
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
          domain={yDomain}
        />
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        <Line
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={stroke}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: stroke }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
