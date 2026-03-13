import { CalendarDays, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useState } from 'react';
import { HubApiResponseError } from '../../api/hubApi';
import { useLeaveRequests } from '../../hooks/useLeaveRequests';
import { EmptyState } from '../shared/EmptyState';
import { ErrorState } from '../shared/ErrorState';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';
import type { LeaveRecord } from '../../api/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    Icon: Clock,
  },
  approved: {
    label: 'Approved',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    Icon: CheckCircle2,
  },
  denied: {
    label: 'Denied',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    Icon: XCircle,
  },
};

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const cfg = STATUS_CONFIG[key] ?? {
    label: status,
    color: 'text-[var(--text-secondary)]',
    bg: 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]',
    Icon: CalendarDays,
  };
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function LeaveCard({ record }: { record: LeaveRecord }) {
  const days = record.daysDeducted != null ? `${record.daysDeducted} day${record.daysDeducted !== 1 ? 's' : ''}` : null;
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{record.employeeName}</p>
            <StatusBadge status={record.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              {record.type}
            </span>
            <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              {record.employeeBrand}
            </span>
            {record.employeeDepartment && (
              <span className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                {record.employeeDepartment}
              </span>
            )}
          </div>
          {record.notes && (
            <p className="mt-1.5 text-xs italic text-[var(--text-tertiary)]">"{record.notes}"</p>
          )}
        </div>
        <div className="text-right text-xs text-[var(--text-tertiary)]">
          <div className="font-medium text-[var(--text-secondary)]">
            {record.startDate}
            {record.endDate !== record.startDate ? ` → ${record.endDate}` : ''}
          </div>
          {days && <div className="mt-0.5">{days}</div>}
        </div>
      </div>
    </div>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
];

export function LeaveOverviewWidget() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const query = useLeaveRequests({ status: activeFilter === 'all' ? undefined : activeFilter, limit: 40 });

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Leave requests</h3>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Most recent Breathe HR leave requests across all brands, filterable by status for admin review.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
          {FILTERS.map((f) => {
            const count = query.data?.statusCounts?.[f.key] ?? null;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeFilter === f.key
                    ? 'bg-white text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {f.label}
                {f.key !== 'all' && count != null && count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      f.key === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : f.key === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <LoadingSkeleton key={n} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          (() => {
            const err = query.error;
            if (err instanceof HubApiResponseError && err.status === 503) {
              return (
                <EmptyState
                  title="Leave data pending auth setup"
                  body="The leave request feed requires the Breathe HR backend to be active in this environment."
                />
              );
            }
            return <ErrorState onRetry={() => void query.refetch()} />;
          })()
        ) : !query.data || query.data.records.length === 0 ? (
          <EmptyState
            title={activeFilter === 'pending' ? 'No pending leave requests' : 'No leave requests found'}
            body={
              activeFilter === 'pending'
                ? 'There are currently no pending leave requests in Breathe HR. The queue is clear.'
                : 'No leave records match this filter for the current dataset.'
            }
          />
        ) : (
          <div className="space-y-2.5">
            {query.data.records.map((record) => (
              <LeaveCard key={record.id} record={record} />
            ))}
            {query.data.total > query.data.records.length && (
              <p className="pt-1 text-center text-xs text-[var(--text-tertiary)]">
                Showing {query.data.records.length} of {query.data.total} matching records
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
