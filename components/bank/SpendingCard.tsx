'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoney } from '@/lib/countries';

type Txn = { amount: number; category: string; status?: string; timestamp?: number };

const settled = (txn: Txn) => txn.status !== 'Pending' && txn.status !== 'Cancelled';

/** Monthly spending worked out automatically from the customer's real transactions. */
export function SpendingCard({ transactions, currency, loading = false }: { transactions: Txn[]; currency: string; loading?: boolean }) {
  const [offset, setOffset] = useState(0); // 0 = this month, -1 = last month, ...

  const data = useMemo(() => {
    const now = new Date();
    const monthRange = (shift: number) => {
      const start = new Date(now.getFullYear(), now.getMonth() + shift, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + shift + 1, 1);
      return { start: start.getTime(), end: end.getTime(), label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), shortLabel: start.toLocaleDateString('en-US', { month: 'long' }) };
    };
    const current = monthRange(offset);
    const previous = monthRange(offset - 1);
    const inRange = (txn: Txn, range: { start: number; end: number }) => (txn.timestamp ?? 0) >= range.start && (txn.timestamp ?? 0) < range.end && settled(txn);
    const spend = (range: { start: number; end: number }) => transactions.filter((t) => t.amount < 0 && inRange(t, range));

    const thisMonth = spend(current);
    const spent = thisMonth.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const spentBefore = spend(previous).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const income = transactions.filter((t) => t.amount > 0 && inRange(t, current)).reduce((sum, t) => sum + t.amount, 0);

    const byCategory = new Map<string, number>();
    thisMonth.forEach((t) => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Math.abs(t.amount)));
    const categories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0).getDate();
    const elapsed = offset === 0 ? now.getDate() : daysInMonth;
    const oldest = transactions.reduce((min, t) => ((t.timestamp ?? Infinity) < min ? (t.timestamp as number) : min), Infinity);
    const canGoBack = Number.isFinite(oldest) && oldest < current.start;

    return { current, previous, spent, spentBefore, income, categories, dailyAverage: elapsed > 0 ? spent / elapsed : 0, canGoBack, count: thisMonth.length };
  }, [transactions, offset]);

  const change = data.spentBefore > 0 ? Math.round(((data.spent - data.spentBefore) / data.spentBefore) * 100) : null;
  const top = data.categories[0]?.[1] ?? 0;

  return (
    <aside className="rounded-3xl bg-[#e7ece5] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Monthly spending</p>
          <h3 className="font-display mt-2 text-2xl text-forest">{data.current.label}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button className="icon-button bg-white" aria-label="Previous month" disabled={!data.canGoBack} onClick={() => setOffset(offset - 1)} style={{ opacity: data.canGoBack ? 1 : 0.4 }}><ChevronLeft size={18} /></button>
          <button className="icon-button bg-white" aria-label="Next month" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} style={{ opacity: offset >= 0 ? 0.4 : 1 }}><ChevronRight size={18} /></button>
        </div>
      </div>

      <p className="mt-6 text-4xl font-medium tracking-tight text-forest" aria-busy={loading}>{loading ? '…' : formatMoney(data.spent, currency)}</p>
      <p className="mt-1 text-xs text-slate-600">
        {loading ? 'Calculating from your transactions…' : data.count === 0 ? 'No spending recorded this month.' : change === null ? `${data.count} payments · nothing spent in ${data.previous.shortLabel} to compare` : `${Math.abs(change)}% ${change > 0 ? 'more' : change < 0 ? 'less' : 'the same'} than ${data.previous.shortLabel} (${formatMoney(data.spentBefore, currency)})`}
      </p>

      <div className="mt-6 space-y-3">
        {data.categories.length === 0 ? null : data.categories.map(([category, total]) => (
          <div key={category}>
            <div className="mb-1 flex justify-between text-xs text-slate-700"><span>{category}</span><span>{formatMoney(total, currency)}</span></div>
            <div className="h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-forest" style={{ width: `${top > 0 ? Math.max(4, (total / top) * 100) : 0}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/70 p-4"><p className="text-xs text-slate-500">Money in</p><p className="mt-2 text-base font-semibold text-forest">{formatMoney(data.income, currency)}</p></div>
        <div className="rounded-2xl bg-white/70 p-4"><p className="text-xs text-slate-500">Daily average</p><p className="mt-2 text-base font-semibold text-forest">{formatMoney(data.dailyAverage, currency)}</p></div>
      </div>
    </aside>
  );
}
