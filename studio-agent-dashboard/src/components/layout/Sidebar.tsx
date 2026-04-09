import {
  Activity,
  Gauge,
  GitCompare,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  Wrench,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { User } from '../../api/auth';
import { Wordmark } from '../shared/Wordmark';

const fallbackUser: User = {
  name: 'Studio User',
  email: 'Sign-in required',
};

const navItems = [
  { to: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/roi', label: 'ROI & Savings', icon: PiggyBank },
  { to: '/dashboard/usage', label: 'Usage & Adoption', icon: Activity },
  { to: '/dashboard/performance', label: 'Performance', icon: Gauge },
  { to: '/dashboard/tools', label: 'Tool Deep Dive', icon: Wrench },
  { to: '/dashboard/bots', label: 'Employee vs Admin', icon: GitCompare },
];

export function Sidebar({ user }: { user: User | null }) {
  const displayUser = user ?? fallbackUser;

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-[240px] flex-col border-r border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-6">
      <Wordmark size="sm" className="px-2" />
      <div className="my-6 h-px bg-[var(--border-subtle)]" />

      <nav className="space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--brand-primary-light)] font-medium text-[var(--brand-primary-dark)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute -left-1 top-2 bottom-2 w-[3px] rounded bg-[var(--brand-primary)]" />}
                <Icon size={20} strokeWidth={1.75} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="mb-4 h-px bg-[var(--border-subtle)]" />
        <div className="px-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">{displayUser.name}</p>
          <p className="truncate text-xs text-[var(--text-tertiary)]">{displayUser.email}</p>
          <a
            className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--color-error)]"
            href="/.auth/logout"
          >
            <LogOut size={12} /> Sign out
          </a>
        </div>
      </div>
    </aside>
  );
}
