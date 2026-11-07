'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Mail, MapPin, MessageSquare, Phone, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';
import { getCountry } from '@/lib/countries';
import type { UserProfile } from '@/lib/types';

type Message = { id: string; sender: 'customer' | 'staff'; body: string; created_at: string; read_at: string | null };

const clock = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/* ---------- Messages (customer <-> banker) ---------- */

export function Messages({ profile, onRead }: { profile: UserProfile; onRead: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('messages').select('id, sender, body, created_at, read_at').order('created_at', { ascending: true }).limit(300);
    const rows = (data ?? []) as Message[];
    setMessages(rows);
    setLoading(false);
    if (rows.some((row) => row.sender === 'staff' && !row.read_at)) {
      await supabase.rpc('mark_messages_read');
      onRead();
    }
  }, [onRead]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !supabase) return;
    if (text.length > 2000) { setError('Messages can be up to 2000 characters.'); return; }
    setError('');
    setSending(true);
    // Show the message immediately; roll it back only if sending fails.
    const tempId = `tmp-${Date.now()}`;
    setMessages((current) => [...current, { id: tempId, sender: 'customer', body: text, created_at: new Date().toISOString(), read_at: null }]);
    setDraft('');
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    const { error: insertError } = await supabase.from('messages').insert({ user_id: userId, sender: 'customer', body: text });
    setSending(false);
    if (insertError) {
      setMessages((current) => current.filter((m) => m.id !== tempId));
      setDraft(text);
      setError('We could not send that. If you signed in more than 24 hours ago, please sign in again with a new code.');
      return;
    }
    // Instant acknowledgement from the bank (server-posted; best effort).
    try { await apiPost('/api/messages/ack', {}); } catch { /* non-fatal */ }
    await load();
  };

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Secure messages</p>
          <h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Message your banker.</h1>
          <p className="mt-2 text-sm text-slate-500">Ask about transfers, access codes, accounts or anything else, {profile.name.split(' ')[0]}. Replies appear here and in your notifications.</p>
        </div>
      </div>
      <section className="mt-8 flex max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-soft" style={{ minHeight: 420 }}>
        <div className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: '55vh' }} aria-live="polite">
          {loading ? <p className="text-sm text-slate-500">Loading messages…</p> : messages.length === 0 ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f0e6] text-forest"><MessageSquare size={22} /></span>
              <p className="mt-4 text-sm font-medium text-ink">No messages yet</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-500">Write to your banker below. For example: “Could I have a new access code?”</p>
            </div>
          ) : messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.sender === 'customer' ? 'rounded-br-md bg-forest text-white' : 'rounded-bl-md bg-[#eef3ee] text-ink'}`}>
                {message.sender === 'staff' && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-forest">Your banker</p>}
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p className={`mt-1 text-[11px] ${message.sender === 'customer' ? 'text-white/60' : 'text-slate-400'}`}>{clock(message.created_at)}</p>
              </div>
            </div>
          ))}
          <div ref={bottom} />
        </div>
        <form onSubmit={send} className="border-t border-stone-100 p-4">
          {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea className="field-input min-h-12 flex-1 resize-none" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" maxLength={2000} aria-label="Message" />
            <button className="primary-button" type="submit" disabled={sending || !draft.trim()} aria-label="Send message"><Send size={16} /> Send</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/* ---------- Help center ---------- */

export function HelpCenter({ profile, onMessage }: { profile: UserProfile; onMessage: () => void }) {
  const country = getCountry(profile.country);
  const faqs: { q: string; a: string }[] = [
    { q: 'How do I sign in?', a: 'Use the username and password your banker created for you, then enter the 6-digit access code they gave you. Each code works once and keeps you signed in for 24 hours. After that you will need a new code.' },
    { q: 'I need a new access code.', a: 'Only your banker can issue access codes. Send them a message from the Messages page and they will reply with a new code.' },
    { q: 'How do I send money?', a: `Open Transfer, pick the destination country and enter the recipient’s bank details. Each country asks for its own details (for example ${country.fields.map((f) => f.label).join(' and ')} for ${country.name}). Every transfer needs a fresh access code and stays pending until your banker approves it.` },
    { q: 'What does “pending” mean?', a: 'Pending means your banker has received the request and has not approved it yet. You will get a notification when it is completed or cancelled, with a note explaining why.' },
    { q: 'How do I add money to my account?', a: `Open Deposit to see the ways to deposit in ${country.name}: ${country.depositMethods.map((m) => m.title).join(', ')}. After you send funds, report the deposit there so your banker can confirm it.` },
    { q: 'How do I pay a bill?', a: 'Open Pay, choose the account to pay from, and enter the payee, their reference and the amount. Like transfers, payments need an access code and your banker’s approval.' },
    { q: 'Why can’t I see some of my history?', a: 'Your banker controls which statement history is shown on your account. If something is missing, send them a message and they can look into it.' },
    { q: 'How do I change my name, email, phone or country?', a: 'For your security these can only be changed by your banker. Send them a message with what you would like updated.' },
    { q: 'Keeping my account safe', a: 'Never share your password or access code with anyone. Your banker will never ask for them outside of issuing a code to you. Sign out when you use a shared device.' },
  ];

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Help center</p>
          <h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">How can we help?</h1>
          <p className="mt-2 text-sm text-slate-500">Answers to common questions, and the quickest ways to reach us.</p>
        </div>
        <button className="primary-button" onClick={onMessage}><MessageSquare size={16} /> Message your banker <ArrowRight size={15} /></button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <a className="metric-card no-underline" href="tel:2765550147"><Phone size={19} /><span>Call us</span><strong className="!text-lg">(276) 555-0147</strong><small>Speak with a banker</small></a>
        <a className="metric-card no-underline" href="mailto:hello@firstbanktrust.com"><Mail size={19} /><span>Email us</span><strong className="!text-lg break-all">hello@firstbanktrust.com</strong><small>We reply by message or email</small></a>
        <div className="metric-card"><MapPin size={19} /><span>Visit us</span><strong className="!text-lg">120 Main Street</strong><small>Abingdon, VA 24210</small></div>
      </div>

      <section className="mt-8 max-w-3xl rounded-3xl bg-white p-2 shadow-soft">
        {faqs.map((item) => (
          <details key={item.q} className="group border-b border-stone-100 px-5 py-4 last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
              {item.q}
              <span className="text-lg leading-none text-forest transition group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
