/**
 * src/components/chat/ChatWidget.tsx
 *
 * Floating bottom-right chat widget for Studio Agent access.
 * Replaces the dedicated AI Hub page — available globally across all dashboard pages.
 */

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Send, AlertCircle, Loader2, X, RotateCcw } from 'lucide-react';
import { hubApi, HubApiResponseError, type ChatMessage } from '../../api/hubApi';

const PLACEHOLDER_PROMPTS = [
  'How many holiday days do I have left?',
  "What's the WFH policy?",
  "Who's in the Chelsea studio today?",
  'Help me log a sick day.',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-primary-light)]">
        <Bot size={24} strokeWidth={1.5} className="text-[var(--brand-primary)]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Studio Agent</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Ask about HR, leave, studio operations, and more.
        </p>
      </div>
      <div className="w-full space-y-1.5">
        {PLACEHOLDER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--text-primary)]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex-shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary-light)]">
            <Bot size={12} strokeWidth={2} className="text-[var(--brand-primary)]" />
          </div>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'bg-[var(--brand-primary)] text-white'
            : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] ring-1 ring-[var(--border-primary)]'
        }`}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {message.text}
      </div>
    </div>
  );
}

function StatusBanner({ status }: { status: 503 | 401 | 'error' | null }) {
  if (!status) return null;
  const messages: Record<string, string> = {
    503: 'Studio Agent is pending Azure AD configuration. It will be available once Allect IT complete setup.',
    401: 'Session expired — please refresh.',
    error: 'Unexpected error. Please try again.',
  };
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--text-primary)]">
      <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
      <span>{messages[String(status)] ?? messages['error']}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bannerStatus, setBannerStatus] = useState<503 | 401 | 'error' | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex w-[360px] flex-col overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] shadow-[0_8px_30px_rgba(0,0,0,0.10)]"
            style={{ height: '520px' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-primary-light)]">
                <Bot size={15} strokeWidth={1.75} className="text-[var(--brand-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] leading-none">Studio Agent</p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Rigby &amp; Rigby · Helen Green · Lawson Robb</p>
              </div>
              {conversationId && (
                <button
                  onClick={resetConversation}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)]"
                  aria-label="New conversation"
                  title="New conversation"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)]"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Message area */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <EmptyState onSelect={(t) => { void sendMessage(t); }} />
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <Bubble key={i} message={msg} />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="mr-2 mt-1 flex-shrink-0">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary-light)]">
                          <Bot size={12} strokeWidth={2} className="text-[var(--brand-primary)]" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-2xl bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-tertiary)] ring-1 ring-[var(--border-primary)]">
                        <Loader2 size={11} className="animate-spin" />
                        Thinking…
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Status banner */}
            {bannerStatus && (
              <div className="px-4 pb-2">
                <StatusBanner status={bannerStatus} />
              </div>
            )}

            {/* Input */}
            <div className="flex items-end gap-2 border-t border-[var(--border-subtle)] px-3 py-3">
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything…"
                disabled={isLoading}
                className="min-h-[36px] flex-1 resize-none rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-primary)] focus:outline-none disabled:opacity-50"
                style={{ maxHeight: '96px' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                }}
              />
              <button
                onClick={() => void sendMessage(inputText)}
                disabled={!inputText.trim() || isLoading}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white transition-opacity disabled:opacity-40 hover:opacity-90"
                aria-label="Send"
              >
                {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB trigger */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-colors ${
          open
            ? 'bg-[var(--bg-primary)] text-[var(--text-secondary)] ring-1 ring-[var(--border-primary)]'
            : 'bg-[var(--brand-primary)] text-white hover:opacity-90'
        }`}
        aria-label={open ? 'Close Studio Agent' : 'Open Studio Agent'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.12 }}>
              <X size={18} />
            </motion.span>
          ) : (
            <motion.span key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.12 }}>
              <Bot size={20} strokeWidth={1.75} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
