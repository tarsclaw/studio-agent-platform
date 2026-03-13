import { motion } from 'framer-motion';
import { Wordmark } from '../components/shared/Wordmark';

export function LoadingScreen() {
  return (
    <div className="landing-bg flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Wordmark size="md" className="mb-8" />
        <div className="relative mx-auto h-[3px] w-[200px] overflow-hidden rounded-full bg-[var(--border-primary)]">
          <motion.span
            className="absolute inset-y-0 left-0 block w-[40%] rounded-full bg-[var(--brand-primary)]"
            animate={{ x: ['-100%', '250%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
        <p className="mt-4 text-sm text-[var(--text-tertiary)]">Preparing your dashboard...</p>
      </div>
    </div>
  );
}
