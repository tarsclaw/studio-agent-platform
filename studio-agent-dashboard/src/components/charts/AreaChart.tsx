import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTooltipLabel } from '../../lib/formatters';
import { CustomTooltip } from './CustomTooltip';

interface AreaTrendProps {
  data: Record<string, any>[];
  dataKey: string;
  stroke?: string;
  formatter?: (value: number) => string;
  height?: number;
}

export function AreaChart({
  data,
  dataKey,
  stroke = 'var(--brand-primary)',
  formatter,
  height = 300,
}: AreaTrendProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.25} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0.04} />
          </linearGradient>
        </defs>
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
          width={52}
        />
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        <Area type="monotone" dataKey={dataKey} stroke={stroke} fill="url(#areaFill)" strokeWidth={2} />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
