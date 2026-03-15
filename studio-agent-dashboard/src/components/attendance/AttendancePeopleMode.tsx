import { Building2, MapPin, Search, UserRoundX } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AttendancePersonSummary } from '../../lib/attendanceSelectors';

export function AttendancePeopleMode({ people }: { people: AttendancePersonSummary[] }) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((person) =>
      [person.employeeName, person.company, person.department, person.location, person.type]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [people, query]);

  const selected = filtered.find((person) => person.employeeName === selectedKey) ?? filtered[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.9fr]">
      <section className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">People mode</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Search across the current absence roster by person, company, team, or location.</p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people or studio"
              className="bg-transparent outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No people match the current search.
            </div>
          ) : (
            filtered.map((person) => {
              const active = person.employeeName === selected?.employeeName;
              return (
                <button
                  key={`${person.employeeName}-${person.startDate}`}
                  onClick={() => setSelectedKey(person.employeeName)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-light)]/40'
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{person.employeeName}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--text-tertiary)]">
                        <span className="inline-flex items-center gap-1"><Building2 size={12} /> {person.company}</span>
                        <span className="inline-flex items-center gap-1"><MapPin size={12} /> {person.location}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-[var(--color-warning)]"><UserRoundX size={12} /> Out</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{person.type}</p>
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
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">{selected.employeeName}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Direct person-level attendance context from the selected daily roster.</p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Company</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{selected.company}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Department</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{selected.department}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Location</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{selected.location}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Status</p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-warning)]">Out · {selected.type}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Absence window</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">Start date</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{selected.startDate}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">End date</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{selected.endDate}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            Choose a person from the roster to inspect their attendance detail.
          </div>
        )}
      </section>
    </div>
  );
}
