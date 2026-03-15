import { ArrowRight, Building2, UserRoundCheck, UserRoundX } from 'lucide-react';
import type { AttendanceCompanySummary } from '../../lib/attendanceSelectors';

export function AttendanceCompanyCard({ company, active, onClick }: { company: AttendanceCompanySummary; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        active
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)]/40 shadow-[0_14px_32px_rgba(15,23,42,0.18)]'
          : 'border-[var(--border-primary)] bg-[var(--bg-elevated)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            <Building2 size={12} /> Company
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{company.name}</h3>
        </div>
        <ArrowRight size={16} className="text-[var(--text-tertiary)]" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-[var(--text-tertiary)]">In</p>
          <p className="mt-1 inline-flex items-center gap-1 font-mono text-xl font-semibold text-[var(--brand-primary)]"><UserRoundCheck size={14} /> {company.present}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-tertiary)]">Out</p>
          <p className="mt-1 inline-flex items-center gap-1 font-mono text-xl font-semibold text-[var(--color-warning)]"><UserRoundX size={14} /> {company.absent}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-tertiary)]">Absence rate</p>
          <p className="mt-1 font-mono text-xl font-semibold text-[var(--text-primary)]">{company.absenceRate}%</p>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-[var(--bg-tertiary)]">
        <div className="h-2 rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.max(10, 100 - company.absenceRate)}%` }} />
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-3">
        <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Most impacted team</p>
        <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{company.topDepartment}</p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{company.total} people tracked in this view</p>
      </div>
    </button>
  );
}
