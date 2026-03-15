type AttendanceMode = 'overview' | 'company' | 'department' | 'people';

const MODES: { value: AttendanceMode; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'company', label: 'Company' },
  { value: 'department', label: 'Department' },
  { value: 'people', label: 'People' },
];

export function AttendanceModeSwitch({ value, onChange }: { value: AttendanceMode; onChange: (mode: AttendanceMode) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-1">
      {MODES.map((mode) => {
        const active = mode.value === value;
        return (
          <button
            key={mode.value}
            onClick={() => onChange(mode.value)}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

export type { AttendanceMode };
