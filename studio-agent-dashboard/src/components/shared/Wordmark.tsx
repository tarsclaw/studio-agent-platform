interface WordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export function Wordmark({ className = '', size = 'md' }: WordmarkProps) {
  return (
    <div className={`inline-flex items-center gap-1 ${sizeClass[size]} ${className}`.trim()}>
      <span className="font-normal text-[var(--text-primary)]">Studio</span>
      <span className="font-bold text-[var(--text-primary)]">Agent</span>
      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
    </div>
  );
}
