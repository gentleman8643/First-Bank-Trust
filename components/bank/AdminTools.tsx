'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Send, MessageSquare } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { ACCOUNT_TYPES, CARD_NETWORKS, LOAN_TYPES, formatCardNumber, monthlyPayment, type AccountType } from '@/lib/accounts';
import { formatMoney, getCountry } from '@/lib/countries';

type Customer = { id: string; display_name: string; username: string; country: string };

const AMOUNT_LABEL: Record<AccountType, string> = {
  checking: 'Opening balance',
  savings: 'Opening balance',
  money_market: 'Opening balance',
  ira: 'Current value',
  credit_card: 'Amount currently owed',
  loan: 'Amount still owed',
  mortgage: 'Amount still owed',
};

function Num({ label, value, onChange, placeholder, help }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; help?: string }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="field-input" value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder={placeholder} />
      {help && <p className="mt-1 text-xs text-slate-500">{help}</p>}
    </div>
  );
}

/* ---------- Open an account of any type ---------- */

export function AdminAccountForm({ customer, onCreated }: { customer: Customer; onCreated: () => void }) {
  const currency = getCountry(customer.country).currency;
  const [type, setType] = useState<AccountType>('checking');
  const [f, setF] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState<{ name: string; cardNumber?: string; expiry?: string; network?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string) => (value: string) => setF((current) => ({ ...current, [key]: value }));
  const get = (key: string, fallback = '') => f[key] ?? fallback;
  const pickType = (next: AccountType) => { setType(next); setF({}); setNotice(''); setCreated(null); };

  const paymentPreview = (type === 'loan' || type === 'mortgage')
    ? monthlyPayment(Number(get('originalAmount') || get('amount') || 0), Number(get('interestRate', type === 'loan' ? '7.5' : '6.5')), Number(get('termMonths', type === 'loan' ? '60' : '360')))
    : 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setCreated(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { userId: customer.id, type, name: get('name') || undefined, amount: get('amount') === '' ? (type === 'loan' || type === 'mortgage' ? get('originalAmount') || 0 : 0) : get('amount') };
      ['creditLimit', 'apr', 'apy', 'minimumBalance', 'contributionsThisYear', 'contributionLimit', 'originalAmount', 'interestRate', 'termMonths', 'dueDay', 'monthlyEscrow'].forEach((key) => { if (get(key) !== '') body[key] = get(key); });
      ['network', 'iraType', 'loanType', 'originationDate', 'propertyAddress', 'rateType'].forEach((key) => { if (get(key) !== '') body[key] = get(key); });
      const result = await apiPost<{ name: string; details: Record<string, any> }>('/api/admin/create-account', body);
      setCreated({ name: result.name, cardNumber: result.details.cardNumber, expiry: result.details.expiry, network: result.details.network });
      setF({});
      onCreated();
    } catch (err) {
      setNotice((err as Error).message || 'Could not open the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-b border-stone-100 bg-cream/60 p-6">
      <p className="field-label">Open an account for {customer.display_name} ({currency})</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Account type</label>
          <select className="field-input" value={type} onChange={(event) => pickType(event.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Name (optional)</label>
          <input className="field-input" value={get('name')} onChange={(event) => set('name')(event.target.value)} placeholder="e.g. Everyday Checking" />
        </div>

        {type !== 'loan' && type !== 'mortgage' && <Num label={`${AMOUNT_LABEL[type]} (${currency})`} value={get('amount')} onChange={set('amount')} placeholder="0.00" />}

        {type === 'savings' && <Num label="APY %" value={get('apy')} onChange={set('apy')} placeholder="3.5" />}
        {type === 'money_market' && <>
          <Num label="APY %" value={get('apy')} onChange={set('apy')} placeholder="4.25" />
          <Num label={`Minimum balance (${currency})`} value={get('minimumBalance')} onChange={set('minimumBalance')} placeholder="1000" />
        </>}

        {type === 'ira' && <>
          <div>
            <label className="field-label">IRA type</label>
            <select className="field-input" value={get('iraType', 'Traditional')} onChange={(event) => set('iraType')(event.target.value)}><option>Traditional</option><option>Roth</option></select>
          </div>
          <Num label={`Contributed this year (${currency})`} value={get('contributionsThisYear')} onChange={set('contributionsThisYear')} placeholder="0" />
          <Num label={`Annual contribution limit (${currency})`} value={get('contributionLimit')} onChange={set('contributionLimit')} placeholder="7000" />
        </>}

        {type === 'credit_card' && <>
          <div>
            <label className="field-label">Card network</label>
            <select className="field-input" value={get('network', 'Visa')} onChange={(event) => set('network')(event.target.value)}>{CARD_NETWORKS.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <Num label={`Credit limit (${currency}) *`} value={get('creditLimit')} onChange={set('creditLimit')} placeholder="5000" />
          <Num label="Purchase APR %" value={get('apr')} onChange={set('apr')} placeholder="19.99" />
          <Num label="Payment due day (1-28)" value={get('dueDay')} onChange={set('dueDay')} placeholder="15" />
          <p className="text-xs leading-5 text-slate-600 sm:col-span-2">A random, realistic card number and expiry are generated automatically. They are placeholders, not a real issued card.</p>
        </>}

        {type === 'loan' && <>
          <div>
            <label className="field-label">Loan type</label>
            <select className="field-input" value={get('loanType', 'Personal loan')} onChange={(event) => set('loanType')(event.target.value)}>{LOAN_TYPES.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
          <Num label={`Original loan amount (${currency}) *`} value={get('originalAmount')} onChange={set('originalAmount')} placeholder="15000" />
          <Num label={`${AMOUNT_LABEL.loan} (${currency})`} value={get('amount')} onChange={set('amount')} placeholder="Leave blank = original amount" />
          <Num label="Interest rate % (APR)" value={get('interestRate')} onChange={set('interestRate')} placeholder="7.5" />
          <Num label="Term (months)" value={get('termMonths')} onChange={set('termMonths')} placeholder="60" />
          <Num label="Payment due day (1-28)" value={get('dueDay')} onChange={set('dueDay')} placeholder="1" />
          <div>
            <label className="field-label">Loan opened on</label>
            <input className="field-input" type="date" value={get('originationDate')} onChange={(event) => set('originationDate')(event.target.value)} />
          </div>
        </>}

        {type === 'mortgage' && <>
          <div className="sm:col-span-2">
            <label className="field-label">Property address</label>
            <input className="field-input" value={get('propertyAddress')} onChange={(event) => set('propertyAddress')(event.target.value)} placeholder="12 Oak Lane, Springfield" />
          </div>
          <Num label={`Original mortgage amount (${currency}) *`} value={get('originalAmount')} onChange={set('originalAmount')} placeholder="320000" />
          <Num label={`${AMOUNT_LABEL.mortgage} (${currency})`} value={get('amount')} onChange={set('amount')} placeholder="Leave blank = original amount" />
          <Num label="Interest rate %" value={get('interestRate')} onChange={set('interestRate')} placeholder="6.5" />
          <div>
            <label className="field-label">Rate type</label>
            <select className="field-input" value={get('rateType', 'Fixed')} onChange={(event) => set('rateType')(event.target.value)}><option>Fixed</option><option>Adjustable</option></select>
          </div>
          <Num label="Term (months)" value={get('termMonths')} onChange={set('termMonths')} placeholder="360" help="360 = 30 years, 180 = 15 years" />
          <Num label={`Monthly escrow: taxes & insurance (${currency})`} value={get('monthlyEscrow')} onChange={set('monthlyEscrow')} placeholder="0" />
          <Num label="Payment due day (1-28)" value={get('dueDay')} onChange={set('dueDay')} placeholder="1" />
          <div>
            <label className="field-label">Mortgage opened on</label>
            <input className="field-input" type="date" value={get('originationDate')} onChange={(event) => set('originationDate')(event.target.value)} />
          </div>
        </>}
      </div>

      {(type === 'loan' || type === 'mortgage') && paymentPreview > 0 && (
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-xs text-slate-700">
          Monthly {type === 'mortgage' ? 'principal & interest' : 'payment'}: <strong>{formatMoney(paymentPreview, currency)}</strong>
          {type === 'mortgage' && Number(get('monthlyEscrow') || 0) > 0 && <> · with escrow <strong>{formatMoney(paymentPreview + Number(get('monthlyEscrow')), currency)}</strong></>}
        </p>
      )}

      {notice && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{notice}</p>}
      {created && (
        <p className="mt-4 rounded-xl bg-[#e3f2e4] px-4 py-3 text-xs leading-5 text-[#2b5f3a]">
          “{created.name}” was opened{created.cardNumber ? <>. {created.network} card <strong className="font-mono">{formatCardNumber(created.cardNumber)}</strong>, valid thru <strong>{created.expiry}</strong>.</> : '.'} The customer has been notified.
        </p>
      )}
      <button className="primary-button mt-5" type="submit" disabled={busy}><Plus size={16} /> {busy ? 'Opening…' : 'Open account'}</button>
    </form>
  );
}

/* ---------- Admin inbox ---------- */

type Conversation = { userId: string; name: string; username: string; lastBody: string; lastAt: string; lastSender: string; unread: number };
type Msg = { id: string; sender: 'customer' | 'staff'; body: string; created_at: string };

export function AdminMessages({ customers, onChanged }: { customers: Customer[]; onChanged: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [thread, setThread] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const { conversations: list } = await apiGet<{ conversations: Conversation[] }>('/api/admin/messages');
      setConversations(list);
    } catch (err) { setNotice((err as Error).message); }
  }, []);

  const openThread = useCallback(async (userId: string) => {
    if (!userId) { setThread([]); return; }
    try {
      const { messages } = await apiGet<{ messages: Msg[] }>(`/api/admin/messages?userId=${encodeURIComponent(userId)}`);
      setThread(messages);
      if (messages.some((m) => m.sender === 'customer')) {
        await apiPost('/api/admin/messages', { action: 'read', userId });
        loadList();
        onChanged();
      }
    } catch (err) { setNotice((err as Error).message); }
  }, [loadList, onChanged]);

  useEffect(() => { loadList(); const t = window.setInterval(loadList, 20000); return () => window.clearInterval(t); }, [loadList]);
  useEffect(() => { openThread(selected); }, [selected, openThread]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [thread.length]);

  const reply = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selected) return;
    // Show the reply immediately; roll it back only if sending fails.
    const tempId = `tmp-${Date.now()}`;
    setBusy(true);
    setNotice('');
    setThread((current) => [...current, { id: tempId, sender: 'staff', body: text, created_at: new Date().toISOString() }]);
    setDraft('');
    try {
      await apiPost('/api/admin/messages', { action: 'reply', userId: selected, body: text });
      await openThread(selected);
      await loadList();
    } catch (err) {
      setThread((current) => current.filter((m) => m.id !== tempId));
      setDraft(text);
      setNotice((err as Error).message || 'Could not send.');
    } finally { setBusy(false); }
  };

  const withHistory = new Set(conversations.map((c) => c.userId));
  const others = customers.filter((c) => !withHistory.has(c.id));
  const selectedName = customers.find((c) => c.id === selected)?.display_name ?? conversations.find((c) => c.userId === selected)?.name ?? '';

  return (
    <section id="messages" className="mt-8 scroll-mt-24 rounded-3xl bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5">
        <div>
          <h2 className="section-title">Customer messages</h2>
          <p className="mt-1 text-xs text-slate-500">Read and reply to your customers. They are notified when you reply.</p>
        </div>
        <span className={`status-pill ${conversations.some((c) => c.unread) ? 'pending' : 'complete'}`}>{conversations.reduce((sum, c) => sum + c.unread, 0)} unread</span>
      </div>
      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <div className="max-h-[420px] overflow-y-auto border-b border-stone-100 lg:border-b-0 lg:border-r">
          {conversations.length === 0 && <p className="px-6 py-6 text-sm text-slate-500">No conversations yet.</p>}
          {conversations.map((c) => (
            <button key={c.userId} onClick={() => setSelected(c.userId)} className={`flex w-full items-start gap-3 border-b border-stone-50 px-5 py-4 text-left transition hover:bg-[#f4f8f4] ${selected === c.userId ? 'bg-[#eef5ee]' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-ink">{c.name}</span>{c.unread > 0 && <span className="rounded-full bg-[#c4874b] px-2 py-0.5 text-[10px] font-bold text-white">{c.unread}</span>}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{c.lastSender === 'staff' ? 'You: ' : ''}{c.lastBody}</span>
              </span>
            </button>
          ))}
          {others.length > 0 && (
            <div className="p-4">
              <label className="field-label">Start a conversation</label>
              <select className="field-input" value="" onChange={(event) => setSelected(event.target.value)}>
                <option value="">Choose a customer…</option>
                {others.map((c) => <option key={c.id} value={c.id}>{c.display_name} · @{c.username}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex min-h-[320px] flex-col">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500"><MessageSquare size={26} /><p className="mt-3 text-sm">Choose a conversation to read it.</p></div>
          ) : (
            <>
              <div className="border-b border-stone-100 px-5 py-3 text-sm font-semibold text-ink">{selectedName}</div>
              <div className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: 340 }}>
                {thread.length === 0 && <p className="text-sm text-slate-500">No messages yet. Write the first one below.</p>}
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'staff' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.sender === 'staff' ? 'rounded-br-md bg-forest text-white' : 'rounded-bl-md bg-[#eef3ee] text-ink'}`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[11px] ${m.sender === 'staff' ? 'text-white/60' : 'text-slate-400'}`}>{new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form onSubmit={reply} className="border-t border-stone-100 p-4">
                {notice && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{notice}</p>}
                <div className="flex items-end gap-2">
                  <textarea className="field-input min-h-12 flex-1 resize-none" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Reply to ${selectedName}…`} maxLength={2000} aria-label="Reply" />
                  <button className="primary-button" type="submit" disabled={busy || !draft.trim()}><Send size={16} /> Send</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
