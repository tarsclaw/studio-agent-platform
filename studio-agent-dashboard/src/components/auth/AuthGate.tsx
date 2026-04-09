import { ArrowRight, ShieldAlert } from 'lucide-react';
import { loginWithMsal } from '../../msalConfig';
import { Wordmark } from '../shared/Wordmark';

const COPY: Record<string, { title: string; body: string }> = {
  sign_in_required: {
    title: 'Sign in required',
    body: 'This dashboard only works with a real Microsoft session. Sign in to load Studio Agent, attendance, and leave data.',
  },
  sign_in_timeout: {
    title: 'Sign-in took too long',
    body: 'The Microsoft redirect started, but the dashboard never received a completed session. Try signing in again.',
  },
  msal_not_configured: {
    title: 'Authentication is not configured',
    body: 'The production dashboard is missing required Microsoft auth configuration, so protected pages are blocked on purpose.',
  },
  sign_in_failed: {
    title: 'Authentication failed',
    body: 'The dashboard could not establish a valid Microsoft session. Try again, and if it repeats, the Entra app setup still needs fixing.',
  },
};

export function AuthGate({ authError }: { authError: string | null }) {
  const copy = COPY[authError ?? 'sign_in_required'] ?? COPY.sign_in_failed;

  return (
    <div className="landing-bg flex min-h-screen items-center justify-center px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-lg rounded-[28px] border border-[var(--border-primary)] bg-[var(--bg-primary)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <Wordmark size="md" className="mb-8" />

        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
          <ShieldAlert size={22} />
        </div>

        <h1 className="mt-6 text-3xl font-bold">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{copy.body}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loginWithMsal()}
            className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"
          >
            Sign in with Microsoft <ArrowRight size={16} />
          </button>
          <a
            href="/"
            className="btn-secondary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"
          >
            Back to landing page
          </a>
        </div>
      </div>
    </div>
  );
}
