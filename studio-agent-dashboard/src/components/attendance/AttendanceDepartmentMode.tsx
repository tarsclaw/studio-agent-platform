import { Building2, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AttendanceDepartmentSummary } from '../../lib/attendanceSelectors';

export function AttendanceDepartmentMode({ departments }: { departments: AttendanceDepartmentSummary[] }) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return departments;
    return departments.filter((department) =>
      [department.name, department.company, ...department.people.map((person) => person.employeeName)]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [departments, query]);

  const selected = filtered.find((item) => `${item.company}-${item.name}` === selectedKey) ?? filtered[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Department mode</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Inspect the teams feeling the most absence pressure today.</p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team or person"
              className="bg-transparent outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No departments match the current search.
            </div>
          ) : (
            filtered.map((department) => {
              const active = `${department.company}-${department.name}` === `${selected?.company}-${selected?.name}`;
              return (
                <button
                  key={`${department.company}-${department.name}`}
                  onClick={() => setSelectedKey(`${department.company}-${department.name}`)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)]/40'
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{department.name}</p>
                      <div className="mt-1 inline-flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                        <Building2 size={12} /> {department.company}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-semibold text-[var(--color-warning)]">{department.absent}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">out today</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-6">
        {selected ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  <Users size={12} /> Team detail
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{selected.name}</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{selected.company} · {selected.absent} recorded absences on the selected date.</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Out today</p>
                <p className="mt-2 font-mono text-3xl font-semibold text-[var(--color-warning)]">{selected.absent}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Tracked here</p>
                <p className="mt-2 font-mono text-3xl font-semibold text-[var(--text-primary)]">{selected.total}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Absence rate</p>
                <p className="mt-2 font-mono text-3xl font-semibold text-[var(--text-primary)]">{selected.absenceRate}%</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">People out</h3>
              <div className="mt-4 space-y-3">
                {selected.people.map((person, index) => (
                  <div key={`${person.employeeName}-${index}`} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{person.employeeName}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{person.location} · {person.brand}</p>
                      </div>
                      <div className="text-right text-xs text-[var(--text-tertiary)]">
                        <div>{person.type}</div>
                        <div>{person.startDate}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            Choose a department to inspect the people and absences inside it.
          </div>
        )}
      </section>
    </div>
  );
}
