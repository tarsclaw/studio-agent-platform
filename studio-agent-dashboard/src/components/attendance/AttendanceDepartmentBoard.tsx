import type { AttendanceDepartmentSummary } from '../../lib/attendanceSelectors';

export function AttendanceDepartmentBoard({ departments }: { departments: AttendanceDepartmentSummary[] }) {
  return (
    <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Department pressure board</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Teams ranked by absence concentration for the selected day.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {departments.slice(0, 8).map((department) => (
          <div key={`${department.company}-${department.name}`} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{department.name}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{department.company}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold text-[var(--color-warning)]">{department.absent} out</p>
                <p className="text-xs text-[var(--text-tertiary)]">{department.people.slice(0, 2).map((item) => item.employeeName).join(', ') || 'No named absences'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
