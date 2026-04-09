import { CalendarDays, CheckCircle2, Layers3, RefreshCw } from 'lucide-react';
import { HubApiResponseError } from '../../api/hubApi';
import { useAuth } from '../../hooks/useAuth';
import { useHolidayAllowances } from '../../hooks/useHolidayAllowances';
import { EmptyState } from '../shared/EmptyState';
import { ErrorState } from '../shared/ErrorState';
import { LoadingSkeleton } from '../shared/LoadingSkeleton';

function formatAmount(value: number | null, units: string) {
  if (value == null || Number.isNaN(value)) return '—';
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${fixed} ${units}`;
}

export function HolidayAllowanceWidget() {
  const { accessToken, status } = useAuth();
  const query = useHolidayAllowances(accessToken, status === 'token_ready');

  if (status !== 'token_ready') {
    return (
      <EmptyState
        title={status === 'redirect_processing' ? 'Holiday policy sign-in still completing' : 'Holiday policy is waiting for dashboard auth'}
        body={
          status === 'redirect_processing'
            ? 'Microsoft sign-in is still being finalised before the holiday policy token can be used.'
            : 'This widget now waits for the shared dashboard auth coordinator before making protected requests.'
        }
      />
    );
  }

  if (query.isLoading) {
    return <LoadingSkeleton className="h-[360px] w-full rounded-2xl" />;
  }

  if (query.isError) {
    const err = query.error;
    if (err instanceof HubApiResponseError && (err.status === 503 || err.status === 401)) {
      return (
        <EmptyState
          title={err.status === 401 ? 'Holiday policy sign-in still completing' : 'Holiday policy sync still completing'}
          body={
            err.status === 401
              ? 'Microsoft sign-in worked, but the dashboard still needs the delegated token to finish settling before holiday policy data can load.'
              : 'The dashboard can already show attendance, but holiday policy coverage will appear here once the Breathe-backed admin endpoint is available in this environment.'
          }
        />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  if (!data) return <ErrorState onRetry={() => void query.refetch()} />;

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Holiday allowance coverage</h3>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Live Breathe summary of which holiday policies are active across the admin population.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-tertiary)]">
          <RefreshCw size={12} />
          Live policy view
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><CalendarDays size={16} /> Team mapped</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--text-primary)]">{data.totalEmployees}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Layers3 size={16} /> Active policies</div>
          <div className="mt-3 font-mono text-3xl font-bold text-[var(--text-primary)]">{data.totalPolicies}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,1))] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><CheckCircle2 size={16} className="text-[var(--brand-primary)]" /> Default policy</div>
          <div className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{data.defaultPolicy?.name ?? 'Not marked'}</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{formatAmount(data.defaultPolicy?.amount ?? null, data.defaultPolicy?.units ?? 'days')}</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Policies in use</h4>
            <span className="text-xs text-[var(--text-tertiary)]">Sorted by employee coverage</span>
          </div>
          <div className="space-y-3">
            {data.policies.map((policy) => (
              <div key={`${policy.id ?? 'none'}-${policy.name}`} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{policy.name}</p>
                      {policy.defaultPolicy && (
                        <span className="rounded-full bg-[var(--brand-primary-light)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-primary-dark)]">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {formatAmount(policy.amount, policy.units)}
                      {policy.dependsOnService ? ' · service-based progression' : ''}
                      {policy.carryoverAllowed ? ' · carryover allowed' : ' · no carryover'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">{policy.employeeCount}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">employees</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {policy.brandMix.map((brand) => (
                    <span key={brand.brand} className="rounded-full border border-[var(--border-primary)] bg-white px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                      {brand.brand} · {brand.count}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Brand coverage</h4>
            <span className="text-xs text-[var(--text-tertiary)]">Current employees</span>
          </div>
          <div className="space-y-3">
            {data.totalsByBrand.map((brand) => {
              const width = `${Math.max(10, (brand.count / Math.max(1, data.totalEmployees)) * 100)}%`;
              return (
                <div key={brand.brand}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--text-primary)]">{brand.brand}</span>
                    <span className="font-mono text-[var(--text-secondary)]">{brand.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-tertiary)]">
                    <div className="h-2 rounded-full bg-[var(--brand-primary)]" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
