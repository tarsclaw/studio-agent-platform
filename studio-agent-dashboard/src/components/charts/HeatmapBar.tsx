import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { CustomTooltip } from './CustomTooltip';

interface HeatmapBarProps {
  data: Array<{ label: string; count: number }>;
}

export function HeatmapBar({ data }: HeatmapBarProps) {
  const peak = Math.max(...data.map((d) => d.count), 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell
              key={`${entry.label}-${idx}`}
              fill={entry.count === peak ? 'var(--brand-primary-dark)' : 'var(--brand-primary)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
