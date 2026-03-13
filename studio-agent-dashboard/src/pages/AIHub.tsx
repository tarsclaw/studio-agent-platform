/**
 * src/pages/AIHub.tsx
 *
 * Wave 1 — AI Hub: primary entry point for the Studio Agent web experience.
 *
 * Provides a direct chat interface to the Studio Agent (Relevance AI employee
 * agent) from the browser.  Functionally equivalent to the Teams bot but
 * accessible without Teams.
 *
 * Status
 *   Backend auth is blocked on AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID
 *   (John Jobling / Allect IT).  The backend returns 503 until those are
 *   configured; this page shows a clear "pending" state rather than failing
 *   silently.
 */

import { useRef, useState } from 'react';
import { Bot, Send, AlertCircle, Loader2 } from 'lucide-react';
import { hubApi, HubApiResponseError, type ChatMessage } from '../api/hubApi';

const PLACEHOLDER_PROMPTS = [
  'How many holiday days do I have left this year?',
  "What's the policy for working from home?",
  "Who's in the office at the Chelsea studio today?",
  'Can you help me log a sick day?',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyPrompts({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-primary-light)]">
        <Bot size={32} strokeWidth={1.5} className="text-[var(--brand-primary)]" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Studio Agent</h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          Ask questions about HR policies, leave, attendance, studio operations, and more.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {PLACEHOLDER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3 text-left text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--text-primary)]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-3 mt-1 flex-shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary-light)]">
            <Bot size={14} strokeWidth={2} className="text-[var(--brand-primary)]" />
          </div>
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--brand-primary)] text-white'
            : 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-primary)]'
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
    503: 'The Studio Agent is not yet fully configured (pending Azure AD credentials from Allect IT). Responses will be available once setup is complete.',
    401: 'Your session has expired or you are not authorised. Please refresh the page.',
    error: 'An unexpected error occurred. Please try again.',
  };
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--text-primary)]">
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
      <span>{messages[status] ?? messages['error']}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function AIHub() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bannerStatus, setBannerStatus] = useState<503 | 401 | 'error' | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
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
    <div className="flex h-[calc(100vh-56px-64px)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">AI Hub</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Your Studio Agent — available across Rigby &amp; Rigby, Helen Green Design, and Lawson Robb.
          </p>
        </div>
        {conversationId && (
          <button
            onClick={() => {
              setMessages([]);
              setConversationId(undefined);
              setBannerStatus(null);
            }}
            className="text-xs text-[var(--text-tertiary)] underline-offset-2 hover:underline"
          >
            New conversation
          </button>
        )}
      </div>

      <StatusBanner status={bannerStatus} />

      {/* Message list */}
      <div className="card flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <EmptyPrompts onSelect={(t) => { setInputText(t); void sendMessage(t); }} />
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="mr-3 mt-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary-light)]">
                    <Bot size={14} strokeWidth={2} className="text-[var(--brand-primary)]" />
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-tertiary)] shadow-sm ring-1 ring-[var(--border-primary)]">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="card flex items-end gap-3 p-3">
        <textarea
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the Studio Agent anything…"
          disabled={isLoading}
          className="min-h-[40px] flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-50"
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
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white transition-opacity disabled:opacity-40 hover:opacity-90"
          aria-label="Send"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
