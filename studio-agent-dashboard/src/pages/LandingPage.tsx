import { motion } from 'framer-motion';
import { ArrowRight, Building2 } from 'lucide-react';
import { Wordmark } from '../components/shared/Wordmark';

const ease = [0.16, 1, 0.3, 1] as const;

export function LandingPage() {
  const signInUrl = '/.auth/login/aad?post_login_redirect_uri=/dashboard';

  return (
    <div className="landing-bg min-h-screen text-[var(--text-primary)]">
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6"
      >
        <Wordmark size="sm" />
        <a href={signInUrl} className="btn-secondary inline-flex items-center gap-2">
          Sign In <ArrowRight size={16} />
        </a>
      </motion.header>

      <main className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl flex-col items-center justify-center px-6 pb-20 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease }}
          className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)]"
        >
          <Building2 size={24} color="var(--brand-primary)" />
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease }}
          className="mb-4 text-4xl font-extrabold"
        >
          Your AI agent, measured.
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease }}
          className="mb-8 max-w-md text-lg text-[var(--text-secondary)]"
        >
          See exactly how much time and money your HR agent saves every month.
        </motion.p>

        <motion.a
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease }}
          href={signInUrl}
          className="btn-primary mb-10 inline-flex items-center gap-2 px-8 py-3 text-base font-semibold"
        >
          Sign in with Microsoft <ArrowRight size={16} />
        </motion.a>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5, ease }}
          className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            ['3,200+', 'tasks automated'],
            ['127', 'hours saved'],
            ['£14.2k', 'saved annually'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4">
              <div className="font-mono text-2xl font-bold">{value}</div>
              <div className="text-sm text-[var(--text-tertiary)]">{label}</div>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="pb-6 text-center text-xs text-[var(--text-tertiary)]">© 2025 Studio Agent · Privacy · Terms</footer>
    </div>
  );
}
