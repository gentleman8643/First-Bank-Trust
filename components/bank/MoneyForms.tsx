'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, Landmark, Plus, ShieldCheck, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiPost, apiPostForm } from '@/lib/api';
import { COUNTRIES, formatMoney, getCountry, validatePaymentFields } from '@/lib/countries';
import type { Account, UserProfile } from '@/lib/types';

/* ---------- small shared pieces ---------- */

function TextField({ label, value, onChange, placeholder, type = 'text', help, maxLength }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; help?: string; maxLength?: number;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} maxLength={maxLength} />
      {help && <p className="mt-1.5 text-xs leading-5 text-slate-500">{help}</p>}
    </div>
  );
}

function AccountPicker({ accounts, index, onChange }: { accounts: Account[]; index: number; onChange: (index: number) => void }) {
  return (
    <div className="md:col-span-2">
      <label className="field-label">From account</label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><div className="mini-account-icon"><Landmark size={16} /></div></div>
        <select className="field-input pl-14" value={index} onChange={(event) => onChange(Number(event.target.value))}>
          {accounts.map((account, position) => (
            <option key={account.id} value={position}>{account.name} · {account.number} — {formatMoney(Math.abs(account.available), account.currency)} available</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CodeBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-2xl bg-[#edf4ed] p-4 md:col-span-2">
      <label className="field-label">Current access code *</label>
      <p className="mb-3 text-xs leading-5 text-slate-600">A fresh code is required whenever you send money. Your banker can issue one.</p>
      <input className="field-input max-w-xs bg-white text-center tracking-[.35em]" value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="••••••" />
    </div>
  );
}

function AmountField({ value, onChange, currency }: { value: string; onChange: (value: string) => void; currency: string }) {
  return (
    <div>
      <label className="field-label">Amount *</label>
      <div className="relative">
        <input className="field-input pr-16" value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" />
        <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">{currency}</span>
      </div>
    </div>
  );
}

function CheckPhoto({ label, side, file, onPick }: { label: string; side: 'front' | 'back'; file: File | null; onPick: (file: File | null) => void }) {
  const preview = file ? URL.createObjectURL(file) : null;
  return (
    <div>
      <label className="field-label">{label} *</label>
      <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-stone-300 bg-white p-3 text-center text-xs text-slate-500 hover:border-[var(--forest)]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label} preview`} className="max-h-28 w-auto rounded-md object-contain" />
        ) : (
          <>
            <ArrowDownToLine size={20} className="text-[var(--forest)]" />
            <span>Tap to take a photo or upload</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          capture={side === 'front' ? 'environment' : undefined}
          className="hidden"
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        />
      </label>
      {file && <button type="button" className="mt-1.5 text-xs font-semibold text-forest underline" onClick={() => onPick(null)}>Replace</button>}
    </div>
  );
}

function Done({ eyebrow, title, children, again, onAgain }: { eyebrow: string; title: string; children: ReactNode; again: string; onAgain: () => void }) {
  return (
    <div className="page-shell">
      <div className="success-panel">
        <div className="success-icon"><Check size={26} /></div>
        <p className="eyebrow justify-center">{eyebrow}</p>
        <h1 className="font-display mt-3 text-4xl text-forest">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600">{children}</p>
        <button className="primary-button mx-auto mt-8" onClick={onAgain}>{again} <Plus size={17} /></button>
      </div>
    </div>
  );
}

function NoAccounts() {
  return (
    <div className="page-shell">
      <div className="success-panel">
        <p className="eyebrow justify-center">No account yet</p>
        <h1 className="font-display mt-3 text-3xl text-forest">Your banker will set up an account first.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600">Once an account is opened for you, you can send money, pay bills and deposit here.</p>
      </div>
    </div>
  );
}

const SERVER_RULE_MESSAGE = 'We could not submit this. If your access code was accepted more than 24 hours ago, sign in again with a new code.';

/* ---------- Transfer (country-specific details) ---------- */

export function Transfer({ accounts, profile, onComplete }: { accounts: Account[]; profile: UserProfile; onComplete: () => void }) {
  const [accountIndex, setAccountIndex] = useState(0);
  const [destCountry, setDestCountry] = useState(profile.country);
  const [recipient, setRecipient] = useState('');
  const [institution, setInstitution] = useState('');
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [accessCode, setAccessCode] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const from = accounts[Math.min(accountIndex, accounts.length - 1)];
  const dest = getCountry(destCountry);
  const domestic = destCountry === profile.country;
  if (!from) return <NoAccounts />;

  const reset = () => { setDone(false); setAmount(''); setRecipient(''); setInstitution(''); setEmail(''); setPhone(''); setDetails({}); setAccessCode(''); setMessage(''); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!recipient.trim() || !institution.trim() || !email.trim() || !phone.trim()) { setMessage('Complete the recipient name, bank, email and phone.'); return; }
    if (!parsed || parsed <= 0) { setMessage('Enter an amount greater than zero.'); return; }
    if (parsed > Math.abs(from.available)) { setMessage(`That is more than the ${formatMoney(Math.abs(from.available), from.currency)} available in this account.`); return; }
    const fieldError = validatePaymentFields(dest, details);
    if (fieldError) { setMessage(fieldError); return; }
    if (accessCode.length !== 6) { setMessage('Enter the 6-digit access code your banker gave you.'); return; }
    if (!supabase) { setMessage('Online banking is temporarily unavailable. Please try again later.'); return; }
    setMessage('');
    setBusy(true);
    try {
      await apiPost('/api/auth/verify-code', { code: accessCode });
      const cleaned: Record<string, string> = {};
      dest.fields.forEach((field) => { cleaned[field.key] = (details[field.key] ?? '').trim(); });
      const { error } = await supabase.from('transactions').insert({
        account_id: from.id,
        merchant: recipient.trim().toUpperCase(),
        amount: -parsed,
        direction: 'debit',
        status: 'pending',
        category: domestic ? 'Bank transfer' : 'International wire',
        transfer_country: destCountry,
        counterparty_email: email.trim(),
        counterparty_phone: phone.trim(),
        payment_details: { ...cleaned, rail: dest.rail, recipientCurrency: dest.currency },
        institution_name: institution.trim(),
        currency: from.currency,
        source: 'customer',
        transaction_date: new Date().toISOString(),
      });
      if (error) { setMessage(SERVER_RULE_MESSAGE); return; }
      setDone(true);
      onComplete();
    } catch (err) {
      setMessage((err as Error).message || 'That access code is invalid, already used, or expired. Ask your banker for a new one.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <Done eyebrow="Transfer submitted" title="Your transfer is pending review." again="Make another transfer" onAgain={reset}>
      We’ll notify you when the transfer to <strong>{recipient}</strong> is approved. You can track its status in your transactions.
    </Done>;
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Move money</p>
          <h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Send a transfer.</h1>
          <p className="mt-2 text-sm text-slate-500">Every outgoing payment stays pending until a banker approves it.</p>
        </div>
        <div className="secure-badge"><ShieldCheck size={15} /> Code required</div>
      </div>
      <form onSubmit={submit} className="mt-8 max-w-3xl rounded-3xl bg-white p-6 shadow-soft md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <AccountPicker accounts={accounts} index={accountIndex} onChange={setAccountIndex} />
          <div className="md:col-span-2">
            <label className="field-label">Destination country *</label>
            <select className="field-input" value={destCountry} onChange={(event) => { setDestCountry(event.target.value); setDetails({}); setMessage(''); }}>
              {COUNTRIES.map((country) => <option key={country.name} value={country.name}>{country.name} ({country.currency})</option>)}
            </select>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Payment method: {dest.rail}. {domestic ? 'This is a domestic transfer.' : `The recipient’s bank receives ${dest.currency}; your banker confirms the exchange rate when approving.`}
            </p>
          </div>
          <TextField label="Recipient name or business *" value={recipient} onChange={setRecipient} placeholder="Who are you sending to?" />
          <TextField label="Receiving bank *" value={institution} onChange={setInstitution} placeholder="Name of the recipient’s bank" />
          <AmountField value={amount} onChange={setAmount} currency={from.currency} />
          <div />
          <div className="md:col-span-2">
            <p className="field-label">Recipient’s {destCountry} bank details</p>
            <div className="grid gap-5 md:grid-cols-2">
              {dest.fields.map((field) => (
                <TextField key={`${destCountry}-${field.key}`} label={`${field.label} *`} value={details[field.key] ?? ''} onChange={(value) => setDetails((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} help={field.help} maxLength={field.maxLength} />
              ))}
            </div>
          </div>
          <TextField label="Recipient email *" value={email} onChange={setEmail} placeholder="recipient@example.com" type="email" />
          <TextField label="Recipient phone *" value={phone} onChange={setPhone} placeholder="Phone number" type="tel" />
          <CodeBox value={accessCode} onChange={setAccessCode} />
        </div>
        {message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-6">
          <p className="max-w-xs text-xs leading-5 text-slate-500">The receiving bank and contact details will appear in your transfer record.</p>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : <>Submit transfer <ArrowRight size={17} /></>}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Pay (bills and payees) ---------- */

export function Pay({ accounts, onComplete }: { accounts: Account[]; onComplete: () => void }) {
  const [accountIndex, setAccountIndex] = useState(0);
  const [payee, setPayee] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const from = accounts[Math.min(accountIndex, accounts.length - 1)];
  if (!from) return <NoAccounts />;

  const reset = () => { setDone(false); setPayee(''); setReference(''); setAmount(''); setMemo(''); setAccessCode(''); setMessage(''); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!payee.trim() || !reference.trim()) { setMessage('Enter who you are paying and their account or invoice reference.'); return; }
    if (!parsed || parsed <= 0) { setMessage('Enter an amount greater than zero.'); return; }
    if (parsed > Math.abs(from.available)) { setMessage(`That is more than the ${formatMoney(Math.abs(from.available), from.currency)} available in this account.`); return; }
    if (accessCode.length !== 6) { setMessage('Enter the 6-digit access code your banker gave you.'); return; }
    if (!supabase) { setMessage('Online banking is temporarily unavailable. Please try again later.'); return; }
    setMessage('');
    setBusy(true);
    try {
      await apiPost('/api/auth/verify-code', { code: accessCode });
      const { error } = await supabase.from('transactions').insert({
        account_id: from.id,
        merchant: payee.trim().toUpperCase(),
        amount: -parsed,
        direction: 'debit',
        status: 'pending',
        category: 'Bill payment',
        payment_details: { reference: reference.trim(), memo: memo.trim() },
        note: memo.trim() || null,
        currency: from.currency,
        source: 'customer',
        transaction_date: new Date().toISOString(),
      });
      if (error) { setMessage(SERVER_RULE_MESSAGE); return; }
      setDone(true);
      onComplete();
    } catch (err) {
      setMessage((err as Error).message || 'That access code is invalid, already used, or expired. Ask your banker for a new one.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <Done eyebrow="Payment submitted" title="Your payment is pending review." again="Pay someone else" onAgain={reset}>
      We’ll let you know once the payment to <strong>{payee}</strong> is approved. You can follow it in your transactions.
    </Done>;
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Pay</p>
          <h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Pay a bill or a person.</h1>
          <p className="mt-2 text-sm text-slate-500">For utilities, rent, cards and invoices. A banker approves every payment.</p>
        </div>
        <div className="secure-badge"><WalletCards size={15} /> Code required</div>
      </div>
      <form onSubmit={submit} className="mt-8 max-w-3xl rounded-3xl bg-white p-6 shadow-soft md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <AccountPicker accounts={accounts} index={accountIndex} onChange={setAccountIndex} />
          <TextField label="Payee *" value={payee} onChange={setPayee} placeholder="Company or person you are paying" />
          <TextField label="Account or invoice reference *" value={reference} onChange={setReference} placeholder="Customer number, invoice or account" />
          <AmountField value={amount} onChange={setAmount} currency={from.currency} />
          <TextField label="Note (optional)" value={memo} onChange={setMemo} placeholder="e.g. March electricity" />
          <CodeBox value={accessCode} onChange={setAccessCode} />
        </div>
        {message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        <div className="mt-8 flex justify-end border-t border-stone-100 pt-6">
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : <>Submit payment <ArrowRight size={17} /></>}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Deposit (methods for the customer's country) ---------- */

export function Deposit({ accounts, profile, onComplete }: { accounts: Account[]; profile: UserProfile; onComplete: () => void }) {
  const country = getCountry(profile.country);
  const [accountIndex, setAccountIndex] = useState(0);
  const [methodIndex, setMethodIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // Mobile check deposit: optional front/back photos of the cheque.
  const [mobileCheck, setMobileCheck] = useState(false);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);

  const to = accounts[Math.min(accountIndex, accounts.length - 1)];
  if (!to) return <NoAccounts />;
  const method = country.depositMethods[Math.min(methodIndex, country.depositMethods.length - 1)];

  const reset = () => { setDone(false); setAmount(''); setReference(''); setMessage(''); setMobileCheck(false); setFront(null); setBack(null); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) { setMessage('Enter the amount you deposited or sent.'); return; }
    if (mobileCheck && (!front || !back)) { setMessage('Add a photo of both the front and the back of the cheque.'); return; }
    if (!supabase) { setMessage('Online banking is temporarily unavailable. Please try again later.'); return; }
    setMessage('');
    setBusy(true);
    try {
      let checkImages: { frontPath: string; backPath: string } | null = null;
      if (mobileCheck && front && back) {
        const body = new FormData();
        body.append('front', front);
        body.append('back', back);
        checkImages = await apiPostForm<{ frontPath: string; backPath: string }>('/api/deposit/upload', body);
      }
      const label = mobileCheck ? 'Mobile check deposit' : method.title;
      const { error } = await supabase.from('transactions').insert({
        account_id: to.id,
        merchant: `DEPOSIT · ${label}`.toUpperCase(),
        amount: parsed,
        direction: 'credit',
        status: 'pending',
        category: 'Deposit',
        payment_details: {
          method: label,
          reference: reference.trim(),
          ...(checkImages ? { checkFront: checkImages.frontPath, checkBack: checkImages.backPath } : {}),
        },
        note: reference.trim() ? `Reference: ${reference.trim()}` : null,
        currency: to.currency,
        source: 'customer',
        transaction_date: new Date().toISOString(),
      });
      if (error) { setMessage(SERVER_RULE_MESSAGE); return; }
      setDone(true);
      onComplete();
    } catch (err) {
      setMessage((err as Error).message || 'We could not upload the cheque images. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <Done eyebrow="Deposit reported" title="We’ve told your banker." again="Report another deposit" onAgain={reset}>
      Your banker will confirm the {formatMoney(Number(amount), to.currency)} deposit once the funds arrive. Until then it shows as pending.
    </Done>;
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Add money · {country.name} · {country.currency}</p>
          <h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Deposit funds.</h1>
          <p className="mt-2 text-sm text-slate-500">Choose how you’ll fund your account. Methods shown are the ones available in {country.name}.</p>
        </div>
        <div className="secure-badge"><ArrowDownToLine size={15} /> {country.currency} account</div>
      </div>
      <div className="mt-8 grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-3xl bg-white p-6 shadow-soft md:p-8">
          <label className="field-label">Deposit into</label>
          <select className="field-input" value={accountIndex} onChange={(event) => setAccountIndex(Number(event.target.value))}>
            {accounts.map((account, position) => <option key={account.id} value={position}>{account.name} · {account.number} ({account.currency})</option>)}
          </select>
          <p className="field-label mt-7">Ways to deposit in {country.name}</p>
          <div className="space-y-3">
            {country.depositMethods.map((item, position) => (
              <button type="button" key={item.title} onClick={() => setMethodIndex(position)} className={`w-full rounded-2xl border p-4 text-left transition ${methodIndex === position ? 'border-[var(--forest)] bg-[#eff5ef]' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                <p className="text-sm font-semibold text-forest">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p>
              </button>
            ))}
          </div>
          <p className="mt-5 rounded-xl bg-cream px-4 py-3 text-xs leading-5 text-slate-600">
            Your account: <strong>{to.name} {to.number}</strong> at First Bank &amp; Trust. Your banker provides the full receiving details for the method you choose.
          </p>
        </section>
        <form onSubmit={submit} className="self-start rounded-3xl bg-white p-6 shadow-soft md:p-8">
          <p className="eyebrow">Already sent it?</p>
          <h2 className="font-display mt-2 text-2xl text-forest">Let your banker know.</h2>
          <div className="mt-6 space-y-5">
            <div>
              <label className="field-label">Method used</label>
              <select className="field-input" value={methodIndex} onChange={(event) => setMethodIndex(Number(event.target.value))}>
                {country.depositMethods.map((item, position) => <option key={item.title} value={position}>{item.title}</option>)}
              </select>
            </div>
            <AmountField value={amount} onChange={setAmount} currency={to.currency} />
            <TextField label="Reference (optional)" value={reference} onChange={setReference} placeholder="Transfer or receipt reference" />
            <div className="rounded-2xl border border-stone-200 bg-cream/50 p-4">
              <label className="flex items-center gap-3 text-sm font-medium text-forest">
                <input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={mobileCheck} onChange={(event) => { setMobileCheck(event.target.checked); setMessage(''); }} />
                Deposit a cheque with photos
              </label>
              {mobileCheck && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <CheckPhoto label="Front of cheque" side="front" file={front} onPick={setFront} />
                  <CheckPhoto label="Back of cheque" side="back" file={back} onPick={setBack} />
                  <p className="sm:col-span-2 text-xs leading-5 text-slate-500">On a phone you can take the photo directly; on a computer you can upload a scan or picture. Endorse the back before photographing it.</p>
                </div>
              )}
            </div>
          </div>
          {message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
          <button className="primary-button mt-6 w-full" type="submit" disabled={busy}>{busy ? 'Sending…' : <>Report deposit <ArrowRight size={17} /></>}</button>
        </form>
      </div>
    </div>
  );
}
