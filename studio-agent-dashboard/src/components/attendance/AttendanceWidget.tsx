import { Building2, MapPin, UserRoundCheck, UserRoundX, Users } from 'lucide-react';
import { useAttendance } from '../../hooks/useAttendance';
import { HubApiResponseError } from '../../api/hubApi';
import { EmptyState } from '../shared/EmptyState';
import { ErrorState } from '../shared/ErrorState';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import type { AttendanceGroupCounts } from '../../api/types';

function GroupList({ title, groups }: { title: string; groups: Record<string, AttendanceGroupCounts> }) {
  const entries = Object.entries(groups).sort((a, b) => (b[1].present + b[1].absent) - (a[1].present + a[1].absent));
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {title === 'By brand' ? <Building2 size={14} /> : <MapPin size={14} />}
        <span>{title}</span>
      </div>
      <div className="space-y-2">
        {entries.map(([name, counts]) => (
          <div key={name} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{counts.present + counts.absent} total</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><UserRoundCheck size={12} className="text-[var(--brand-primary)]" />{counts.present}</span>
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><UserRoundX size={12} className="text-[var(--color-warning)]" />{counts.absent}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttendanceWidget() {
  const query = useAttendance();

  if (query.isLoading) {
    return <LoadingSkeleton className="h-[420px] w-full rounded-2xl" />;
  }

  if (query.isError) {
    const err = query.error;
    if (err instanceof HubApiResponseError && err.status === 503) {
      return (
        <EmptyState
          title="Attendance setup still completing"
          body="The Breathe-backed Who's In / Who's Out feed is wired, but the final auth/integration path still needs completing before live attendance data can display here."
        />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  if (!data) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  const absences = data.absences ?? [];

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Who's In / Who's Out</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Live HR attendance view for {data.date}.</p>
        </div>
        <div className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-tertiary)]">
          {data.totalEmployees} employees
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Users size={16} /> Total team</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--text-primary)]">{data.totalEmployees}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><UserRoundCheck size={16} className="text-[var(--brand-primary)]" /> In today</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--brand-primary)]">{data.totalPresent}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><UserRoundX size={16} className="text-[var(--color-warning)]" /> Out today</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--color-warning)]">{data.totalAbsent}</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GroupList title="By brand" groups={data.byBrand} />
        <GroupList title="By location" groups={data.byLocation} />
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Who's out</h4>
          <span className="text-xs text-[var(--text-tertiary)]">{absences.length} absent</span>
        </div>
        {absences.length === 0 ? (
          <EmptyState title="Nobody is out today" body="No absences were returned for today, so the whole team appears present." />
        ) : (
          <div className="space-y-2">
            {absences.map((absence, index) => (
              <div key={`${absence.employeeName}-${absence.startDate}-${index}`} className="flex items-start justify-between gap-4 rounded-lg bg-[var(--bg-secondary)] px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{absence.employeeName}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{absence.type} · {absence.brand} · {absence.location}</p>
                </div>
                <div className="text-right text-xs text-[var(--text-tertiary)]">
                  <div>{absence.startDate}</div>
                  <div>{absence.endDate}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
