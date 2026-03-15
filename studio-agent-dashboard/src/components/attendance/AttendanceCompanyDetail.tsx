import { Building2, MapPin, UserRoundCheck, UserRoundX } from 'lucide-react';
import type { AttendanceResponse } from '../../api/types';
import type { AttendanceCompanySummary } from '../../lib/attendanceSelectors';

export function AttendanceCompanyDetail({ company, data }: { company: AttendanceCompanySummary; data: AttendanceResponse }) {
  const companyAbsences = (data.absences ?? []).filter((item) => item.brand === company.name);
  const byDepartment = Object.entries(
    companyAbsences.reduce<Record<string, number>>((acc, item) => {
      acc[item.department || 'Unknown'] = (acc[item.department || 'Unknown'] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const byLocation = Object.entries(
    companyAbsences.reduce<Record<string, number>>((acc, item) => {
      acc[item.location || 'Unknown'] = (acc[item.location || 'Unknown'] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            <Building2 size={12} /> Company focus
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{company.name}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Focused attendance breakdown for {company.name}, including the most affected teams, office concentration, and the current absence roster.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">In</p>
            <p className="mt-2 inline-flex items-center gap-1 font-mono text-2xl font-semibold text-[var(--brand-primary)]"><UserRoundCheck size={14} /> {company.present}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Out</p>
            <p className="mt-2 inline-flex items-center gap-1 font-mono text-2xl font-semibold text-[var(--color-warning)]"><UserRoundX size={14} /> {company.absent}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Absence rate</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-[var(--text-primary)]">{company.absenceRate}%</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Most affected departments</h3>
            <div className="mt-4 space-y-3">
              {(byDepartment.length ? byDepartment : [['No absences', 0]]).slice(0, 5).map(([department, count]) => (
                <div key={department} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{department}</p>
                    <p className="font-mono text-sm text-[var(--color-warning)]">{count} out</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Office concentration</h3>
            <div className="mt-4 space-y-3">
              {(byLocation.length ? byLocation : [['No absences', 0]]).slice(0, 4).map(([location, count]) => (
                <div key={location} className="flex items-center justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><MapPin size={14} /> {location}</div>
                  <p className="font-mono text-sm text-[var(--text-secondary)]">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Absence roster</h3>
          <div className="mt-4 space-y-3">
            {companyAbsences.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                No absences are currently recorded for {company.name} on the selected date.
              </div>
            ) : (
              companyAbsences.slice(0, 10).map((absence, index) => (
                <div key={`${absence.employeeName}-${absence.startDate}-${index}`} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{absence.employeeName}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{absence.department} · {absence.location}</p>
                    </div>
                    <div className="text-right text-xs text-[var(--text-tertiary)]">
                      <div>{absence.type}</div>
                      <div>{absence.startDate}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
