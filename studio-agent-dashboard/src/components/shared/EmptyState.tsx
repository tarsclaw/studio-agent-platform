import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  body?: string;
}

export function EmptyState({
  title = 'Awaiting data',
  body = 'This metric will populate once conversation tracking is active.',
}: EmptyStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-6 text-center">
      <Inbox size={40} color="var(--text-tertiary)" />
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}
