import { CalendarRange } from 'lucide-react';
import type { AttendanceAbsenceRecord } from '../../api/types';
import { EmptyState } from '../shared/EmptyState';

export function AttendanceAbsencePreview({ absences }: { absences: AttendanceAbsenceRecord[] }) {
  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Today's absences</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">People currently recorded as out, with company and team context.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--text-tertiary)]">
          <CalendarRange size={12} /> {absences.length} recorded
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {absences.length === 0 ? (
          <EmptyState title="Nobody is out today" body="No absences were returned for the selected date." />
        ) : (
          absences.slice(0, 8).map((absence, index) => (
            <div key={`${absence.employeeName}-${absence.startDate}-${index}`} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{absence.employeeName}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">{absence.brand}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">{absence.department}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">{absence.location}</span>
                  </div>
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
    </section>
  );
}
