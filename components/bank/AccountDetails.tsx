'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ACCOUNT_TYPE_LABELS, formatCardNumber, isDebt } from '@/lib/accounts';
import { formatMoney } from '@/lib/countries';
import type { Account } from '@/lib/types';

const niceDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const years = (months?: number) => {
  if (!months) return '—';
  return months % 12 === 0 ? `${months / 12} years` : `${months} months`;
};

/** Facts to show for an account, by type. */
export function accountFacts(account: Account): { label: string; value: string }[] {
  const d = account.details ?? {};
  const money = (value: unknown) => formatMoney(Number(value ?? 0), account.currency);
  const owed = Math.abs(account.balance);
  switch (account.type) {
    case 'credit_card':
      return [
        { label: 'Credit limit', value: money(d.creditLimit) },
        { label: 'Amount owed', value: money(owed) },
        { label: 'Available credit', value: money(account.available) },
        { label: 'Purchase APR', value: `${d.apr ?? '—'}%` },
        { label: 'Minimum payment', value: money(d.minimumPayment) },
        { label: 'Payment due', value: niceDate(d.paymentDueDate) },
      ];
    case 'ira': {
      const limit = Number(d.contributionLimit ?? 0);
      const done = Number(d.contributionsThisYear ?? 0);
      return [
        { label: 'IRA type', value: d.iraType ?? 'Traditional' },
        { label: 'Current value', value: money(account.balance) },
        { label: 'Contributed this year', value: money(done) },
        { label: 'Annual limit', value: money(limit) },
        { label: 'Room left this year', value: money(Math.max(0, limit - done)) },
      ];
    }
    case 'money_market':
      return [
        { label: 'Current balance', value: money(account.balance) },
        { label: 'APY', value: `${d.apy ?? '—'}%` },
        { label: 'Minimum balance', value: money(d.minimumBalance) },
      ];
    case 'savings':
      return [
        { label: 'Current balance', value: money(account.balance) },
        { label: 'APY', value: `${d.apy ?? '—'}%` },
        { label: 'Account number', value: `•••• ${account.number.replace(/^x/, '')}` },
      ];
    case 'loan':
      return [
        { label: 'Loan type', value: d.loanType ?? 'Loan' },
        { label: 'Loan number', value: `•••• ${String(d.loanNumber ?? '').slice(-4)}` },
        { label: 'Original amount', value: money(d.originalAmount) },
        { label: 'Remaining balance', value: money(owed) },
        { label: 'Interest rate', value: `${d.interestRate ?? '—'}% APR` },
        { label: 'Term', value: years(d.termMonths) },
        { label: 'Monthly payment', value: money(d.monthlyPayment) },
        { label: 'Next payment due', value: niceDate(d.nextPaymentDate) },
        { label: 'Opened', value: niceDate(d.originationDate) },
        { label: 'Final payment', value: niceDate(d.maturityDate) },
      ];
    case 'mortgage':
      return [
        { label: 'Property', value: d.propertyAddress ?? '—' },
        { label: 'Loan number', value: `•••• ${String(d.loanNumber ?? '').slice(-4)}` },
        { label: 'Original amount', value: money(d.originalAmount) },
        { label: 'Remaining balance', value: money(owed) },
        { label: 'Interest rate', value: `${d.interestRate ?? '—'}% (${d.rateType ?? 'Fixed'})` },
        { label: 'Term', value: years(d.termMonths) },
        { label: 'Monthly payment', value: money(d.monthlyPayment) },
        { label: 'Principal & interest', value: money(d.monthlyPrincipalInterest) },
        { label: 'Escrow (taxes & insurance)', value: money(d.monthlyEscrow) },
        { label: 'Next payment due', value: niceDate(d.nextPaymentDate) },
        { label: 'Opened', value: niceDate(d.originationDate) },
        { label: 'Final payment', value: niceDate(d.maturityDate) },
      ];
    default:
      return [
        { label: 'Available balance', value: money(account.available) },
        { label: 'Account number', value: `•••• ${account.number.replace(/^x/, '')}` },
        { label: 'Currency', value: account.currency },
      ];
  }
}

export function AccountDetailPanel({ account, holder }: { account: Account; holder: string }) {
  const [reveal, setReveal] = useState(false);
  const d = account.details ?? {};
  const facts = accountFacts(account);
  const original = Number(d.originalAmount ?? 0);
  const paidOff = (account.type === 'loan' || account.type === 'mortgage') && original > 0 ? Math.min(100, Math.max(0, Math.round((1 - Math.abs(account.balance) / original) * 100))) : null;
  const cardNumber = String(d.cardNumber ?? '');
  const last4 = cardNumber.slice(-4) || account.number.replace(/^x/, '');
  const masked = cardNumber.length === 15 ? `•••• •••••• •${last4}` : `•••• •••• •••• ${last4}`;

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">{ACCOUNT_TYPE_LABELS[account.type] ?? account.type} · {account.currency}</p>
          <h2 className="font-display mt-1 text-2xl text-forest">{account.name}</h2>
        </div>
        {isDebt(account.type) && <span className="status-pill pending">Money you owe</span>}
      </div>

      {account.type === 'credit_card' && cardNumber && (
        <div className="mt-5 max-w-sm rounded-2xl bg-gradient-to-br from-[#14463a] to-[#0a2a22] p-6 text-white shadow-soft">
          <div className="flex items-start justify-between">
            <span className="text-xs uppercase tracking-[.2em] text-white/60">First Bank &amp; Trust</span>
            <span className="text-sm font-semibold">{d.network}</span>
          </div>
          <p className="mt-8 font-mono text-lg tracking-[.12em]" aria-label={reveal ? 'Card number' : 'Card number hidden'}>{reveal ? formatCardNumber(cardNumber) : masked}</p>
          <div className="mt-6 flex items-end justify-between text-xs">
            <div><p className="text-white/50">Cardholder</p><p className="mt-1 font-medium uppercase">{holder}</p></div>
            <div className="text-right"><p className="text-white/50">Valid thru</p><p className="mt-1 font-medium">{d.expiry}</p></div>
          </div>
        </div>
      )}
      {account.type === 'credit_card' && cardNumber && (
        <button className="outline-button mt-3" onClick={() => setReveal(!reveal)}>{reveal ? <><EyeOff size={15} /> Hide card number</> : <><Eye size={15} /> Show card number</>}</button>
      )}

      {paidOff !== null && (
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs text-slate-600"><span>Paid off</span><span>{paidOff}%</span></div>
          <div className="h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-forest" style={{ width: `${paidOff}%` }} /></div>
        </div>
      )}

      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="border-b border-stone-100 pb-3">
            <dt className="text-xs text-slate-500">{fact.label}</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
