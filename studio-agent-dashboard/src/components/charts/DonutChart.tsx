import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CustomTooltip } from './CustomTooltip';

interface DonutPoint {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutPoint[];
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ data, centerLabel, centerValue }: DonutChartProps) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} innerRadius={70} outerRadius={95} paddingAngle={2} dataKey="value">
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {centerValue && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-2xl font-semibold text-[var(--text-primary)]">{centerValue}</div>
          {centerLabel && <div className="text-xs text-[var(--text-tertiary)]">{centerLabel}</div>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
