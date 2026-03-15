// Monthly subscription / platform cost (£) used for ROI calculations.
// Override via VITE_MONTHLY_PLATFORM_COST if needed.
export const MONTHLY_PLATFORM_COST: number =
  Number(import.meta.env.VITE_MONTHLY_PLATFORM_COST) || 500;

// Badge colours for tool categories (background + foreground tokens).
export const CATEGORY_COLOURS: Record<string, { bg: string; text: string }> = {
  read:     { bg: 'var(--brand-primary-light)',   text: 'var(--brand-primary-dark)' },
  write:    { bg: 'rgba(251,146,60,0.15)',         text: '#c2410c' },
  policy:   { bg: 'rgba(139,92,246,0.15)',         text: '#6d28d9' },
  resolver: { bg: 'rgba(16,185,129,0.15)',         text: '#065f46' },
};

// Page title / subtitle shown in the TopBar, keyed by route pathname.
export const ROUTE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':             { title: 'AI Hub',             subtitle: 'Chat with your studio assistant' },
  '/dashboard/ai-hub':      { title: 'AI Hub',             subtitle: 'Chat with your studio assistant' },
  '/dashboard/overview':    { title: 'Overview',           subtitle: 'Key metrics at a glance' },
  '/dashboard/attendance':  { title: 'Who’s In / Who’s Out', subtitle: 'Live attendance visibility across all studios and brands' },
  '/dashboard/roi':         { title: 'ROI & Savings',      subtitle: 'Financial impact of AI automation' },
  '/dashboard/usage':       { title: 'Usage & Adoption',   subtitle: 'How the team is using the bot' },
  '/dashboard/performance': { title: 'Performance',        subtitle: 'Latency and reliability metrics' },
  '/dashboard/tools':       { title: 'Tool Deep Dive',     subtitle: 'Per-tool execution breakdown' },
  '/dashboard/bots':        { title: 'Employee vs Admin',  subtitle: 'Bot usage by audience' },
};
