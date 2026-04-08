/**
 * src/components/chat/ChatWidget.tsx
 *
 * Floating bottom-right chat widget for Studio Agent access.
 * Replaces the dedicated AI Hub page — available globally across all dashboard pages.
 */

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Mail,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { hubApi, HubApiResponseError, type ChatMessage } from '../../api/hubApi';

const PLACEHOLDER_PROMPTS = [
  'What needs my attention today across the studios?',
  'Are any teams under staffing pressure today?',
  'Give me a company-wide attendance summary.',
  'Any urgent leave or operational issues I should know about?',
];

function StudioAgentMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/50 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.25)] ${
        compact ? 'h-8 w-8 rounded-xl' : 'h-11 w-11'
      }`}
    >
      <div className="absolute inset-[1px] rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.35),transparent_55%)]" />
      <ShieldCheck size={compact ? 15 : 20} strokeWidth={2} className="relative z-10" />
      <Sparkles size={compact ? 10 : 12} className="absolute right-1.5 top-1.5 z-10 text-white/90" />
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-5 py-5">
      <div className="rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.94))] px-4 py-4 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700">
            <Mail size={16} />
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Sandbox widget path is live</p>
            <p className="mt-1 leading-relaxed">
              Studio Agent is ready to use inside the dashboard widget. Responses currently reflect sandbox HR data, so focus on flow reliability and agent behavior rather than production-grade personal records.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-primary)] bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.95))] px-4 py-4">
        <StudioAgentMark />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Admin assistant, ready</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            Use Studio Agent for a fast leadership readout across attendance, leave pressure, and operational risks.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Try one of these
        </p>
        <div className="grid gap-2">
          {PLACEHOLDER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSelect(prompt)}
              className="group w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3.5 py-3 text-left text-sm text-[var(--text-secondary)] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
            >
              <span className="flex items-start justify-between gap-3">
                <span>{prompt}</span>
                <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--brand-primary)]" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2.5 mt-1 flex-shrink-0">
          <StudioAgentMark compact />
        </div>
      )}
      <div
        className={`max-w-[84%] rounded-[20px] px-4 py-3 text-sm leading-relaxed shadow-[var(--shadow-sm)] ${
          isUser
            ? 'bg-[var(--brand-primary)] text-white'
            : 'border border-[var(--border-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
        }`}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {message.text}
      </div>
    </div>
  );
}

function StatusBanner({ status }: { status: 503 | 403 | 401 | 'error' | null }) {
  if (!status) return null;

  if (status === 503) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-300/70 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.96))] px-3.5 py-3 text-xs text-[var(--text-primary)] shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Studio Agent is temporarily unavailable</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              The widget is live, but the backend is currently refusing authenticated Studio Agent requests. Check deployment flags and dashboard auth configuration before retrying.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">What to check</p>
          <p className="mt-1">
            Confirm widget rollout flags are enabled and the deployed dashboard auth settings still match the intended Studio Agent environment.
          </p>
        </div>
      </div>
    );
  }

  const messages: Record<string, string> = {
    401: 'Your dashboard sign-in expired. Refresh and sign in again to continue.',
    403: 'Your sign-in was verified, but Studio Agent could not safely match it to a person record yet. This is blocked on purpose rather than guessing.',
    error: 'Something went wrong while contacting Studio Agent. Please retry.',
  };
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-2.5 text-xs text-[var(--text-primary)]">
      <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
      <span>{messages[String(status)] ?? messages.error}</span>
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bannerStatus, setBannerStatus] = useState<503 | 403 | 401 | 'error' | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  const quickStatus = useMemo(() => {
    if (isLoading) return 'Working';
    if (conversationId) return 'Live conversation';
    return 'Admin ready';
  }, [conversationId, isLoading]);

  function resetConversation() {
    setMessages([]);
    setConversationId(undefined);
    setBannerStatus(null);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInputText('');
    setIsLoading(true);
    setBannerStatus(null);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const res = await hubApi.chat({ text: trimmed, conversation_id: conversationId });
      setConversationId(res.conversation_id);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
    } catch (err) {
      if (err instanceof HubApiResponseError) {
        if (err.status === 503) setBannerStatus(503);
        else if (err.status === 403) setBannerStatus(403);
        else if (err.status === 401) setBannerStatus(401);
        else setBannerStatus('error');
      } else {
        setBannerStatus('error');
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(inputText);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex w-[420px] flex-col overflow-hidden rounded-[28px] border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
            style={{ height: '620px' }}
          >
            <div className="border-b border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.96))] px-5 py-4">
              <div className="flex items-start gap-3">
                <StudioAgentMark />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Studio Agent</p>
                    <span className="rounded-full border border-emerald-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      {quickStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Leadership support for attendance, leave pressure, and what needs attention today, tuned for the current sandbox data environment.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-white/70 bg-white/80 px-2.5 py-1 font-medium text-[var(--text-secondary)]">
                      Widget live
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                      Sandbox mode
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {conversationId && (
                    <button
                      onClick={resetConversation}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-colors hover:bg-white hover:text-[var(--text-secondary)]"
                      aria-label="New conversation"
                      title="New conversation"
                    >
                      <RotateCcw size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-colors hover:bg-white hover:text-[var(--text-secondary)]"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <EmptyState onSelect={(t) => void sendMessage(t)} />
              ) : (
                <div className="space-y-3.5">
                  {messages.map((msg, i) => (
                    <Bubble key={i} message={msg} />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="mr-2.5 mt-1 flex-shrink-0">
                        <StudioAgentMark compact />
                      </div>
                      <div className="flex items-center gap-2 rounded-[20px] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
                        <Loader2 size={14} className="animate-spin" />
                        Studio Agent is thinking…
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {bannerStatus && (
              <div className="px-5 pb-3">
                <StatusBanner status={bannerStatus} />
              </div>
            )}

            {!bannerStatus && messages.length === 0 && (
              <div className="px-5 pb-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">Sandbox note:</span> identity and chat flow are live. Personal answers may reflect fixture HR records while the widget remains on sandbox data.
                  </div>
                  <a
                    href="https://entra.microsoft.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-primary)] bg-white px-2 py-1 font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                  >
                    Entra <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-4">
              <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Studio Agent anything admin-related…"
                    disabled={isLoading}
                    className="min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-50"
                    style={{ maxHeight: '120px' }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                  />
                  <button
                    onClick={() => void sendMessage(inputText)}
                    disabled={!inputText.trim() || isLoading}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white shadow-[0_10px_25px_rgba(16,185,129,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[var(--brand-primary-dark)] disabled:translate-y-0 disabled:opacity-40"
                    aria-label="Send"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.96 }}
        className={`group flex h-14 items-center gap-2.5 rounded-full px-4 shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition-all ${
          open
            ? 'border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
            : 'bg-[linear-gradient(135deg,var(--brand-primary),var(--brand-primary-dark))] text-white hover:-translate-y-0.5'
        }`}
        aria-label={open ? 'Close Studio Agent' : 'Open Studio Agent'}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            open ? 'bg-[var(--bg-secondary)]' : 'bg-white/16'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="x"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <X size={18} />
              </motion.span>
            ) : (
              <motion.span
                key="mark"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <ShieldCheck size={18} strokeWidth={2} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="pr-1 text-sm font-semibold">Studio Agent</span>
      </motion.button>
    </div>
  );
}
