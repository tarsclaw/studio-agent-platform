import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { User } from '../../api/auth';
import { ROUTE_META } from '../../lib/constants';
import { PeriodSelector } from './PeriodSelector';

export function TopBar({ user }: { user: User }) {
  const { pathname } = useLocation();
  const current = ROUTE_META[pathname] || ROUTE_META['/dashboard'];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <header className="fixed left-[240px] right-0 top-0 z-20 h-14 border-b border-[var(--border-primary)] bg-[var(--bg-primary)] px-8">
      <div className="flex h-full items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{current.title}</h1>
          <p className="text-sm text-[var(--text-tertiary)]">{current.subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <PeriodSelector />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary-light)] text-sm font-semibold text-[var(--brand-primary-dark)]"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Open user menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {user.name.charAt(0).toUpperCase()}
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-md border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-md)]"
                role="menu"
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{user.name}</p>
                <p className="truncate text-xs text-[var(--text-tertiary)]">{user.email}</p>
                <a
                  href="/.auth/logout"
                  className="mt-3 inline-flex text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--color-error)]"
                  role="menuitem"
                >
                  Sign out
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
