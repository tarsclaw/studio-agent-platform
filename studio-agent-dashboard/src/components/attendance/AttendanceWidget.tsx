import {
  ArrowUpRight,
  Building2,
  Clock3,
  MapPin,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAttendance } from '../../hooks/useAttendance';
import { HubApiResponseError } from '../../api/hubApi';
import { EmptyState } from '../shared/EmptyState';
import { ErrorState } from '../shared/ErrorState';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import type { AttendanceGroupCounts } from '../../api/types';

function GroupList({ title, groups }: { title: string; groups: Record<string, AttendanceGroupCounts> }) {
  const entries = Object.entries(groups).sort((a, b) => (b[1].present + b[1].absent) - (a[1].present + a[1].absent));
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {title === 'By brand' ? <Building2 size={14} /> : <MapPin size={14} />}
        <span>{title}</span>
      </div>
      <div className="space-y-2.5">
        {entries.map(([name, counts]) => {
          const total = counts.present + counts.absent;
          const presentWidth = `${Math.max(10, (counts.present / Math.max(1, total)) * 100)}%`;
          return (
            <div key={name} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{total} total people tracked</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><UserRoundCheck size={12} className="text-[var(--brand-primary)]" />{counts.present}</span>
                  <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><UserRoundX size={12} className="text-[var(--color-warning)]" />{counts.absent}</span>
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[var(--bg-tertiary)]">
                <div className="h-2 rounded-full bg-[var(--brand-primary)]" style={{ width: presentWidth }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AttendanceWidget() {
  const query = useAttendance();

  if (query.isLoading) {
    return <LoadingSkeleton className="h-[480px] w-full rounded-2xl" />;
  }

  if (query.isError) {
    const err = query.error;
    if (err instanceof HubApiResponseError && err.status === 503) {
      return (
        <EmptyState
          title="Attendance setup still completing"
          body="The Breathe-backed attendance feed is wired, but the final auth and runtime configuration still needs to be active before live attendance can show here."
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
  const presenceRate = data.totalEmployees > 0 ? Math.round((data.totalPresent / data.totalEmployees) * 100) : 0;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Who's in today</h3>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Live Breathe attendance for {data.date}, summarised for admin review across brands, locations, and active absences.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-tertiary)]">
            <Clock3 size={12} />
            Refreshed live from HR
          </div>
          <Link
            to="/dashboard/attendance"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)]"
          >
            Open attendance view <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Users size={16} /> Total team</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--text-primary)]">{data.totalEmployees}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,1))] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><UserRoundCheck size={16} className="text-[var(--brand-primary)]" /> In today</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--brand-primary)]">{data.totalPresent}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,1))] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><UserRoundX size={16} className="text-[var(--color-warning)]" /> Out today</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--color-warning)]">{data.totalAbsent}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><ShieldCheck size={16} /> Presence rate</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--text-primary)]">{presenceRate}%</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Today's absences</h4>
            <span className="text-xs text-[var(--text-tertiary)]">{absences.length} recorded</span>
          </div>
          {absences.length === 0 ? (
            <EmptyState title="Nobody is out today" body="No absences were returned for today, so the full team appears present in the live HR feed." />
          ) : (
            <div className="space-y-2.5">
              {absences.map((absence, index) => (
                <div key={`${absence.employeeName}-${absence.startDate}-${index}`} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{absence.employeeName}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">{absence.type}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">{absence.brand}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">{absence.location}</span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-tertiary)]">{absence.department}</p>
                    </div>
                    <div className="text-right text-xs text-[var(--text-tertiary)]">
                      <div>{absence.startDate}</div>
                      <div>{absence.endDate}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <GroupList title="By brand" groups={data.byBrand} />
          <GroupList title="By location" groups={data.byLocation} />
        </div>
      </div>
    </section>
  );
}
