import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { askEnergyAdvisor, errorMessage } from '../services/api';

const STARTER_QUESTIONS = [
  'Where can I reduce energy waste?',
  'Make me a 30-day energy plan.',
  'Which zones should I review first?',
  'How can I lower operating costs?',
];

const makeMessage = (role, content) => ({ id: `${Date.now()}-${Math.random()}`, role, content });
const welcomeMessage = makeMessage('assistant', 'Hi, I’m your energy advisor. Ask about your workspace, energy-saving ideas, or an action plan.');

export default function EnergyAdvisor({ isDemo, isOnline }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const wasOpen = useRef(false);
  const canAsk = !isDemo && isOnline;

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      inputRef.current?.focus();
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      launcherRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  const startNewChat = () => {
    setMessages([makeMessage('assistant', 'New conversation started. What would you like to improve?')]);
    setDraft('');
    setError('');
    inputRef.current?.focus();
  };

  const sendMessage = async (event, suggestedQuestion) => {
    event?.preventDefault();
    const question = (suggestedQuestion ?? draft).trim();
    if (!question || busy || !canAsk) return;

    const previousMessages = messages;
    setMessages((current) => [...current, makeMessage('user', question)]);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const history = previousMessages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .slice(-8)
        .map(({ role, content }) => ({ role, content }));
      const response = await askEnergyAdvisor({ question, history });
      setMessages((current) => [...current, makeMessage('assistant', response.answer)]);
    } catch (requestError) {
      setError(errorMessage(requestError, 'The energy advisor could not respond. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ss-advisor-root">
      {open && <section className="ss-advisor-panel" role="dialog" aria-modal="false" aria-label="Energy advisor chat">
        <header className="ss-advisor-header">
          <span className="ss-advisor-avatar"><Sparkles size={16} /></span>
          <div><strong>Energy advisor</strong><small>Practical guidance for your workspace</small></div>
          <button type="button" className="ss-advisor-icon" onClick={startNewChat} disabled={busy} aria-label="Start a new conversation" title="New chat"><MessageCircle size={15} /></button>
          <button type="button" className="ss-advisor-icon" onClick={() => setOpen(false)} aria-label="Close energy advisor"><X size={17} /></button>
        </header>

        <div className="ss-advisor-messages" ref={listRef} role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message) => <article className={`ss-advisor-message is-${message.role}`} key={message.id}>
            {message.role === 'assistant' && <span className="ss-advisor-message-icon"><Bot size={13} /></span>}
            <p>{message.content}</p>
          </article>)}
          {busy && <article className="ss-advisor-message is-assistant"><span className="ss-advisor-message-icon"><Bot size={13} /></span><p className="ss-advisor-thinking"><LoaderCircle size={13} className="ss-spin" /> Reviewing your workspace…</p></article>}
          {messages.length === 1 && canAsk && <div className="ss-advisor-prompts"><span>TRY ASKING</span>{STARTER_QUESTIONS.map((question) => <button type="button" key={question} disabled={busy} onClick={(event) => void sendMessage(event, question)}>{question}</button>)}</div>}
          {isDemo && <div className="ss-advisor-notice"><ShieldCheck size={14} /><span>Sign in to use the live advisor. It needs an AI key configured on the workspace API.</span></div>}
          {!isDemo && !isOnline && <div className="ss-advisor-notice"><ShieldCheck size={14} /><span>Connect to your workspace API to start an advisor chat.</span></div>}
          {error && <div className="ss-advisor-error" role="alert">{error}</div>}
        </div>

        <form className="ss-advisor-composer" onSubmit={(event) => void sendMessage(event)}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) void sendMessage(event); }}
            placeholder={canAsk ? 'Ask about energy, plans, or costs…' : 'Advisor unavailable in this session'}
            aria-label="Message the energy advisor"
            maxLength={1200}
            rows={2}
            disabled={!canAsk || busy}
          />
          <button type="submit" disabled={!canAsk || busy || !draft.trim()} aria-label="Send message"><Send size={15} /></button>
          <small>Your prompt and limited workspace summaries are sent to the configured AI provider. Avoid personal or confidential details.</small>
        </form>
      </section>}

      <button ref={launcherRef} type="button" className={`ss-advisor-launch${open ? ' is-open' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close energy advisor' : 'Ask the energy advisor'}>
        {open ? <X size={18} /> : <><Sparkles size={16} /><span>Ask AI</span></>}
      </button>
    </div>
  );
}
