import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AttendanceAlertItem } from '../../lib/attendanceSelectors';

export function AttendanceAlertsPanel({ alerts }: { alerts: AttendanceAlertItem[] }) {
  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Operational signals</h3>
      <div className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <div key={alert.title} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
            <div className="flex items-start gap-3">
              {alert.tone === 'positive' ? (
                <CheckCircle2 size={18} className="mt-0.5 text-[var(--brand-primary)]" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 text-[var(--color-warning)]" />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{alert.title}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{alert.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
