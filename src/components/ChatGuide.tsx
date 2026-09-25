import { useEffect, useRef, useState } from 'react';
import { localAnswer } from '../lib/localGuide';

// "Ask about Arsh": streams answers from /api/chat, and falls back to the local answer
// engine when the API isn't configured.

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = ['What has he built?', 'Which technologies does he use?', 'Tell me about PaintX.ai', 'How can I contact him?'];
const GREETING: Msg = { role: 'assistant', content: 'Hi, I’m Arsh’s guide for this site. Ask me about his projects, skills, studies, or how to reach him.' };

let remoteAvailable: boolean | null = null;

async function ask(history: Msg[], onText: (t: string) => void): Promise<void> {
  if (remoteAvailable !== false) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.filter((m) => m !== GREETING) }),
      });
      if (res.ok && res.body) {
        remoteAvailable = true;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let text = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
          onText(text);
        }
        if (text.trim()) return;
      } else if (res.status === 503 || res.status === 404 || res.status === 405) {
        remoteAvailable = false;
      }
    } catch {
      remoteAvailable = false;
    }
  }
  // Offline: answer from local facts, revealed quickly word by word for the same feel.
  const answer = localAnswer(history[history.length - 1].content);
  const words = answer.split(/(\s+)/);
  let out = '';
  for (const w of words) {
    out += w;
    onText(out);
    await new Promise((r) => setTimeout(r, 12));
  }
}

export function ChatGuide() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('guide:open', onOpen);
    return () => window.removeEventListener('guide:open', onOpen);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    const history = [...messages, { role: 'user' as const, content: q.slice(0, 1500) }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      await ask(history, (t) => setMessages([...history, { role: 'assistant', content: t }]));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`guide${open ? ' is-open' : ''}`}>
      <section className="guide__panel" role="dialog" aria-label="Ask about Arsh" aria-hidden={!open} inert={!open}>
        <header className="guide__head">
          <span className="guide__orb" aria-hidden="true" />
          <div>
            <p className="guide__title">Ask about Arsh</p>
            <p className="guide__sub">About Arsh and this site only</p>
          </div>
          <button className="guide__close" type="button" onClick={() => setOpen(false)} aria-label="Close guide">
            ×
          </button>
        </header>
        <div className="guide__list" ref={listRef} aria-live="polite" data-lenis-prevent>
          {messages.map((m, i) => (
            <p key={i} className={`guide__msg guide__msg--${m.role}`}>
              {m.content || <span className="guide__typing" aria-label="Thinking" />}
            </p>
          ))}
          {messages.length === 1 && (
            <div className="guide__chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <form
          className="guide__form"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            aria-label="Your question"
            maxLength={1500}
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
            ↑
          </button>
        </form>
      </section>
      <button className="guide__launcher" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Close guide' : 'Ask about Arsh'}>
        <span className="guide__orb" aria-hidden="true" />
        <span className="guide__launcher-text">Ask about Arsh</span>
      </button>
    </div>
  );
}
