import { AnimatePresence, motion } from 'framer-motion';
import { Outlet } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useSummary } from '../../hooks/useSummary';
import { useTrends } from '../../hooks/useTrends';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../../pages/LoadingScreen';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ChatWidget } from '../chat/ChatWidget';
import { AuthGate } from '../auth/AuthGate';

function lastThirtyDaysRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function Shell() {
  const { user, loading, authError } = useAuth();
  const isAuthed = Boolean(user);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);

  const { from, to } = useMemo(lastThirtyDaysRange, []);
  const summary = useSummary(isAuthed);
  const trends = useTrends(from, to, isAuthed);

  useEffect(() => {
    const min = window.setTimeout(() => setMinimumElapsed(true), 1500);
    const max = window.setTimeout(() => setMaxElapsed(true), 4000);
    return () => {
      window.clearTimeout(min);
      window.clearTimeout(max);
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthed) {
    return <AuthGate authError={authError} />;
  }

  const dataReady = minimumElapsed && (summary.isSuccess || maxElapsed) && (trends.isSuccess || maxElapsed);
  const ready = dataReady;

  return (
    <AnimatePresence mode="wait">
      {!ready ? (
        <motion.div key="loading" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <LoadingScreen />
        </motion.div>
      ) : (
        <motion.div
          key="shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen"
        >
          <Sidebar user={user} />
          <TopBar user={user} />
          <ChatWidget />
          <main className="ml-[240px] bg-[var(--bg-secondary)] pt-14">
            <div className="h-[calc(100vh-56px)] overflow-y-auto p-8">
              <div className="mx-auto max-w-[1400px]">
                <Outlet />
              </div>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
