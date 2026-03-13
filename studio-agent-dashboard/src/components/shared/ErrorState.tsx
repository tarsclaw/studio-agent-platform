import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  onRetry?: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-6 text-center">
      <AlertTriangle size={40} color="var(--color-error)" />
      <h3 className="text-base font-semibold text-[var(--text-primary)]">Failed to load data</h3>
      <p className="text-sm text-[var(--text-secondary)]">Something went wrong. Please try again.</p>
      {onRetry && (
        <button className="btn-secondary mt-1" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
