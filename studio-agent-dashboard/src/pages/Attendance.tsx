import { CalendarDays, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAttendance } from '../hooks/useAttendance';
import { AttendanceAbsencePreview } from '../components/attendance/AttendanceAbsencePreview';
import { AttendanceAlertsPanel } from '../components/attendance/AttendanceAlertsPanel';
import { AttendanceCompanyCard } from '../components/attendance/AttendanceCompanyCard';
import { AttendanceDepartmentBoard } from '../components/attendance/AttendanceDepartmentBoard';
import { AttendanceModeSwitch, type AttendanceMode } from '../components/attendance/AttendanceModeSwitch';
import { AttendanceSummaryBand } from '../components/attendance/AttendanceSummaryBand';
import { EmptyState } from '../components/shared/EmptyState';
import { ErrorState } from '../components/shared/ErrorState';
import { LoadingSkeleton } from '../components/shared/LoadingSkeleton';
import { getAttendanceAlerts, getCompanySummaries, getDepartmentSummaries, getLocationSummaries } from '../lib/attendanceSelectors';
import { HubApiResponseError } from '../api/hubApi';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function Attendance() {
  const [date, setDate] = useState(todayDateString());
  const [mode, setMode] = useState<AttendanceMode>('overview');
  const [selectedCompany, setSelectedCompany] = useState('Allect');
  const query = useAttendance(date);

  const model = useMemo(() => {
    if (!query.data) return null;
    const companies = getCompanySummaries(query.data);
    return {
      companies,
      departments: getDepartmentSummaries(query.data),
      alerts: getAttendanceAlerts(query.data),
      locations: getLocationSummaries(query.data),
      selectedCompany: companies.find((item) => item.name === selectedCompany) ?? companies[0] ?? null,
    };
  }, [query.data, selectedCompany]);

  if (query.isLoading) {
    return <LoadingSkeleton className="h-[680px] w-full rounded-3xl" />;
  }

  if (query.isError) {
    const err = query.error;
    if (err instanceof HubApiResponseError && err.status === 503) {
      return (
        <EmptyState
          title="Attendance setup still completing"
          body="The live attendance feed is wired, but the final runtime configuration is still being completed in this environment."
        />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  if (!query.data || !model) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--border-primary)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0.96))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Attendance</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--text-primary)]">Who’s In / Who’s Out</h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)]">
              Live attendance and absence visibility across all studios and brands, with drill-downs for company, department, and people-level checks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              <CalendarDays size={16} />
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="bg-transparent outline-none" />
            </label>
            <button onClick={() => void query.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
              <RefreshCcw size={16} /> Refresh
            </button>
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
              Updated from Breathe for {query.data.date}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <AttendanceModeSwitch value={mode} onChange={setMode} />
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
          Filters and deeper people search will layer in on top of this foundation next.
        </div>
      </div>

      <AttendanceSummaryBand data={query.data} />

      {mode === 'overview' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Company coverage</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">Compare today’s staffing picture across Allect, Rigby & Rigby, Helen Green, and Lawson Robb.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {model.companies.map((company) => (
                  <AttendanceCompanyCard key={company.name} company={company} active={company.name === model.selectedCompany?.name} onClick={() => setSelectedCompany(company.name)} />
                ))}
              </div>
            </section>

            <AttendanceDepartmentBoard departments={model.departments} />

            <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Office footprint</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {model.locations.map((location) => (
                  <div key={location.name} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{location.name}</p>
                    <div className="mt-3 flex items-center justify-between text-sm text-[var(--text-secondary)]">
                      <span>{location.total} tracked</span>
                      <span>{location.absent} out</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[var(--bg-tertiary)]">
                      <div className="h-2 rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.max(10, 100 - location.absenceRate)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <AttendanceAlertsPanel alerts={model.alerts} />
            <AttendanceAbsencePreview absences={query.data.absences} />
          </div>
        </div>
      )}

      {mode === 'company' && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {model.companies.map((company) => (
              <AttendanceCompanyCard key={company.name} company={company} active={company.name === model.selectedCompany?.name} onClick={() => setSelectedCompany(company.name)} />
            ))}
          </section>
          {model.selectedCompany ? (
            <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{model.selectedCompany.name}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Deep company view with strongest current signals and absence roster preview.</p>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">In today</p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-[var(--brand-primary)]">{model.selectedCompany.present}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Out today</p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-[var(--color-warning)]">{model.selectedCompany.absent}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Most impacted team</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{model.selectedCompany.topDepartment}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <AttendanceAlertsPanel alerts={model.alerts.filter((alert) => alert.title.toLowerCase().includes(model.selectedCompany!.name.toLowerCase()) || alert.title.toLowerCase().includes('highest absence'))} />
                <AttendanceAbsencePreview absences={query.data.absences.filter((item) => item.brand === model.selectedCompany?.name)} />
              </div>
            </section>
          ) : null}
        </div>
      )}

      {(mode === 'department' || mode === 'people') && (
        <EmptyState
          title={`${mode === 'department' ? 'Department' : 'People'} mode is next in the build queue`}
          body="This first implementation slice prioritises the route, summary, overview, and company drill-down experience. Department and people modes are planned next."
        />
      )}
    </div>
  );
}
