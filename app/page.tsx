'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowDown,
  ExternalLink,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  Home as HomeIcon,
  Landmark,
  LockKeyhole,
  LogOut,
  Menu,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiGet, apiPost } from '@/lib/api';
import { COUNTRY_NAMES, formatMoney, getCountry } from '@/lib/countries';
import type { Account, UserProfile } from '@/lib/types';
import { Deposit, Pay, Transfer } from '@/components/bank/MoneyForms';
import { AccountDetailPanel } from '@/components/bank/AccountDetails';
import { SpendingCard } from '@/components/bank/SpendingCard';
import { NotificationBell } from '@/components/bank/NotificationBell';
import { HelpCenter, Messages } from '@/components/bank/MessagesAndHelp';
import { AdminAccountForm, AdminMessages } from '@/components/bank/AdminTools';
import { ACCOUNT_TYPE_LABELS, canDepositTo, formatCardNumber, isDebt, isSpendable } from '@/lib/accounts';

type View = 'landing' | 'login' | 'contact' | 'dashboard' | 'transactions' | 'transfer' | 'deposit' | 'pay' | 'messages' | 'help' | 'profile' | 'admin';
type Transaction = {
  id: string | number;
  merchant: string;
  detail: string;
  amount: number;
  date: string;
  category: string;
  status?: 'Pending' | 'Complete' | 'Cancelled';
  note?: string;
  /** Milliseconds since epoch, used by the date filter. */
  timestamp?: number;
  currency?: string;
};

// A transaction row as returned by GET /api/admin/list-transactions.
type AdminTxn = {
  id: string;
  user_id: string;
  customer_name: string;
  merchant: string;
  amount: number;
  status: 'pending' | 'complete' | 'cancelled' | 'received';
  category: string;
  note: string | null;
  admin_description: string | null;
  institution_name: string | null;
  transfer_country: string | null;
  source: string;
  is_hidden: boolean;
  transaction_date: string;
  currency: string;
  counterparty_email: string | null;
  counterparty_phone: string | null;
  payment_details: Record<string, unknown> | null;
};

// A customer as returned by GET /api/admin/list-customers.
type AdminAccount = {
  id: string;
  name: string;
  type: string;
  masked_number: string;
  balance: number;
  available_balance: number;
  currency: string;
  details: Record<string, any>;
};
type AdminCustomer = {
  id: string;
  display_name: string;
  email: string;
  username: string;
  role: string;
  status: string;
  country: string;
  accounts: AdminAccount[];
  hasActiveCode: boolean;
};



// Format a DB transaction_date into a friendly "Mon, Nov 25" label.
const formatTxnDate = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', sameYear ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

const dbStatusToLabel = (status: string | null | undefined): Transaction['status'] => {
  switch (status) {
    case 'complete': return 'Complete';
    case 'pending': return 'Pending';
    case 'cancelled': return 'Cancelled';
    default: return undefined;
  }
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'justify-center'}`}>
      <div className="brand-mark"><Landmark size={21} strokeWidth={2.4} /></div>
      <div>
        <div className="font-display text-[17px] font-semibold tracking-tight text-forest">First Bank <span className="text-gold">&amp;</span> Trust</div>
        {!compact && <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Your partner in progress</div>}
      </div>
    </div>
  );
}

function Avatar({ name = 'User' }: { name?: string }) {
  return <div className="avatar">{name.split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</div>;
}

const productPhotos = {
  // Personal loans — a new home, "plans that move your life forward"
  loan: 'https://images.pexels.com/photos/4469150/pexels-photo-4469150.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // Money market — counting savings with calculator and cash
  advice: 'https://images.pexels.com/photos/4386325/pexels-photo-4386325.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // Credit cards — contactless card payment
  card: 'https://images.pexels.com/photos/11009960/pexels-photo-11009960.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // Business loans — small-business owners with an "Open" sign
  business: 'https://images.pexels.com/photos/36729522/pexels-photo-36729522.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // IRA — retired couple at home, long-term retirement savings
  retirement: 'https://images.pexels.com/photos/5591235/pexels-photo-5591235.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // Apply from another country — passport and compass on a world map
  international: 'https://images.pexels.com/photos/7235900/pexels-photo-7235900.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
};

function Login({ onLogin, onAdmin, onBack }: { onLogin: () => void; onAdmin: () => void; onBack: () => void }) {
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  const requestNewCode = () => {
    setNotice('');
    setConfirmation('Your banker has been notified and will issue a new access code shortly.');
  };

  const submitCredentials = async (event: FormEvent) => {
    event.preventDefault();
    if (!username || !password) return setNotice('Enter the username and password provided by your banker.');
    if (!supabase) return setNotice('Online banking is temporarily unavailable. Please try again later.');
    setNotice('');
    setConfirmation('');
    setBusy(true);
    try {
      const { email } = await apiPost<{ email: string }>('/api/auth/resolve-username', { username: username.trim() });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setNotice('We could not find an account with those details. Check the username and password your banker gave you.');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      if (profile?.role === 'admin') {
        onAdmin();
        return;
      }
      setStep('code');
    } catch {
      setNotice('We could not find an account with those details. Check the username and password your banker gave you.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return setNotice('Enter the 6-digit access code your banker gave you.');
    setNotice('');
    setConfirmation('');
    setBusy(true);
    try {
      await apiPost('/api/auth/verify-code', { code });
      onLogin();
    } catch (err) {
      setNotice((err as Error).message || 'That access code is invalid, already used, or expired. Ask your banker for a new one.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-screen"><div className="auth-panel"><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to First Bank &amp; Trust</button><div className="mt-8"><Brand compact /><p className="eyebrow mt-12">Online banking</p><h1 className="font-display mt-3 text-4xl text-forest">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-slate-500">Sign in with the credentials created for you by your banker.</p></div>{step === 'credentials' ? <form onSubmit={submitCredentials} className="mt-8 space-y-5"><Field label="Username" value={username} onChange={setUsername} placeholder="Your username" /><Field label="Password" value={password} onChange={setPassword} placeholder="Your password" type="password" /><button className="primary-button w-full" type="submit" disabled={busy}>{busy ? 'Checking…' : <>Continue <ArrowRight size={17} /></>}</button></form> : <form onSubmit={submitCode} className="mt-8 space-y-5"><button type="button" className="back-link" onClick={() => setStep('credentials')}><ArrowLeft size={15} /> Back</button><div><label className="field-label">Current access code</label><p className="mb-3 text-xs leading-5 text-slate-500">A new code is required on your first login and again after 24 hours.</p><input className="field-input text-center text-2xl tracking-[.45em]" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="••••••" /></div><button className="primary-button w-full" type="submit" disabled={busy}>{busy ? 'Verifying…' : <>Verify and sign in <ArrowRight size={17} /></>}</button><button type="button" onClick={requestNewCode} className="mx-auto block text-xs font-medium text-forest underline underline-offset-4">Request a new code</button></form>}{notice && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>}{confirmation && <p className="mt-4 flex items-center gap-2 rounded-xl bg-[#e3f2e4] px-4 py-3 text-sm text-[#317344]"><Check size={16} /> {confirmation}</p>}<div className="mt-8 flex items-center gap-3 border-t border-stone-100 pt-5 text-xs text-slate-500"><ShieldCheck size={16} className="text-forest" /> Protected by First Bank &amp; Trust security</div></div></div>;
}

function ContactForm({ interest, onBack }: { interest: string; onBack: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', street_address: '', city: '', state: 'Virginia', zip_code: '', loan_reason: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!form.full_name || !form.email || !form.phone || !form.street_address || !form.city || !form.zip_code) return setNotice('Please complete the required contact details.'); setNotice(''); if (supabase) { const { error } = await supabase.from('contact_requests').insert({ ...form, interest }); if (error) { console.error('contact request failed', error); setNotice('We could not send your request right now. Please call our team instead.'); return; } } setSubmitted(true); };
  if (submitted) return <div className="contact-success"><div className="success-icon"><Check size={26} /></div><p className="eyebrow justify-center">Request received</p><h1 className="font-display mt-3 text-4xl text-forest">We’ll be in touch soon.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600">A First Bank &amp; Trust banker will contact you about your {interest.toLowerCase()} request using the details you provided.</p><button className="primary-button mx-auto mt-8" onClick={onBack}>Return to home <ArrowRight size={17} /></button></div>;
  return <div className="contact-shell"><div className="contact-intro"><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to home</button><p className="eyebrow mt-14">Let’s start a conversation</p><h1 className="font-display mt-4 text-5xl leading-[1.03] text-forest">Tell us how we can help.</h1><p className="mt-5 max-w-sm text-sm leading-7 text-slate-600">Share a few details and a banker will reach out to make the next step easy.</p><div className="mt-10 rounded-2xl bg-forest p-5 text-white"><p className="text-xs uppercase tracking-[.16em] text-white/60">You selected</p><p className="mt-2 text-xl font-medium">{interest}</p><button className="mt-4 text-xs font-bold text-gold underline underline-offset-4" onClick={onBack}>Choose another product</button></div><div className="mt-8 space-y-3 text-sm text-slate-600"><p className="flex items-center gap-3"><Phone size={16} className="text-forest" />(276) 555-0147</p><p className="flex items-center gap-3"><Mail size={16} className="text-forest" />hello@firstbanktrust.com</p><p className="flex items-center gap-3"><MapPin size={16} className="text-forest" />120 Main Street, Abingdon, VA 24210</p></div></div><form onSubmit={submit} className="contact-card"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Contact details</p><h2 className="font-display mt-2 text-3xl text-forest">A little about you.</h2></div><div className="secure-icon"><LockKeyhole size={18} /></div></div><div className="mt-8 grid gap-5 md:grid-cols-2"><div className="md:col-span-2"><Field label="Full name *" value={form.full_name} onChange={(value) => update('full_name', value)} placeholder="First and last name" /></div><Field label="Email address *" value={form.email} onChange={(value) => update('email', value)} placeholder="you@example.com" type="email" /><Field label="Phone number *" value={form.phone} onChange={(value) => update('phone', value)} placeholder="(000) 000-0000" type="tel" /><div className="md:col-span-2"><Field label="Street address *" value={form.street_address} onChange={(value) => update('street_address', value)} placeholder="123 Main Street" /></div><Field label="City *" value={form.city} onChange={(value) => update('city', value)} placeholder="Your city" /><div><label className="field-label">State *</label><select className="field-input" value={form.state} onChange={(event) => update('state', event.target.value)}><option>Virginia</option><option>North Carolina</option><option>Tennessee</option><option>Maryland</option><option>Other</option></select></div><Field label="ZIP code *" value={form.zip_code} onChange={(value) => update('zip_code', value)} placeholder="00000" />{interest.toLowerCase().includes('loan') && <div className="md:col-span-2"><label className="field-label">What is the loan for?</label><select className="field-input" value={form.loan_reason} onChange={(event) => update('loan_reason', event.target.value)}><option value="">Select a reason</option><option>Buying a home</option><option>Buying a vehicle</option><option>Home improvement</option><option>Debt consolidation</option><option>Growing my business</option><option>Something else</option></select></div>}<div className="md:col-span-2"><label className="field-label">Anything else you’d like us to know?</label><textarea className="field-input min-h-24 resize-y" value={form.message} onChange={(event) => update('message', event.target.value)} placeholder="Tell us a little more about what you’re looking for" /></div></div>{notice && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>}<button className="primary-button mt-7 w-full" type="submit">Send my request <ArrowRight size={17} /></button><p className="mt-4 text-center text-xs leading-5 text-slate-500">Your information is private and will only be used by our banking team.</p></form></div>;
}

function Landing({ onLogin, onContact }: { onLogin: () => void; onContact: (interest: string) => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const products = [
    { title: 'Personal loans', copy: 'Flexible financing for the plans that move your life forward.', image: productPhotos.loan, interest: 'Personal loan' },
    { title: 'Money market', copy: 'A smarter place for your savings to grow with access when you need it.', image: productPhotos.advice, interest: 'Money market' },
    { title: 'Credit cards', copy: 'Everyday flexibility, thoughtful rewards, and protection built in.', image: productPhotos.card, interest: 'Credit card' },
    { title: 'Business loans', copy: 'Tailored financing solutions for your business growth and operational needs.', image: productPhotos.business, interest: 'Business loan' },
    { title: 'IRA', copy: 'Retirement savings with tax advantages and long-term growth potential.', image: productPhotos.retirement, interest: 'IRA' },
    { title: 'Apply from another country', copy: 'Open an account remotely with our international application process.', image: productPhotos.international, interest: 'International application' }
  ];
  return <div className="landing"><header className="site-header"><a href="#top"><Brand /></a><nav className="site-nav"><a href="#products">Products</a><a href="#why-us">Why First Bank</a><a href="#contact">Contact</a></nav><div className="header-actions"><button className="outline-button" onClick={onLogin}>Login</button><button className="primary-button" onClick={() => onContact('Checking account')}>Create an account <ArrowRight size={15} /></button></div><button className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>{mobileMenuOpen && <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}><div className="mobile-menu-panel" onClick={(event) => event.stopPropagation()}><div className="mobile-menu-top"><Brand /><button className="icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={22} /></button></div><a href="#products" onClick={() => setMobileMenuOpen(false)}>Products</a><a href="#why-us" onClick={() => setMobileMenuOpen(false)}>Why First Bank</a><a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a><button className="outline-button w-full" onClick={() => { setMobileMenuOpen(false); onLogin(); }}>Login</button><button className="primary-button w-full" onClick={() => { setMobileMenuOpen(false); onContact('Checking account'); }}>Create an account <ArrowRight size={15} /></button></div></div>}</header><main id="top"><section className="landing-hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot" /> More than a bank</p><h1 className="font-display">Build what’s next with a bank that <em>knows you.</em></h1><p>From your first checking account to the home, business, and future you’re building, First Bank &amp; Trust is here with personal guidance and useful tools.</p><div className="hero-actions"><button className="primary-button" onClick={() => onContact('Checking account')}>Start a conversation <ArrowRight size={17} /></button><button className="text-button" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>Explore our products <ArrowDown size={16} /></button></div><div className="hero-trust"><span><ShieldCheck size={17} /> Member FDIC</span><span><UsersRound size={17} /> Locally guided</span></div></div><div className="hero-visual"><div className="hero-photo" style={{ backgroundImage: `url(${productPhotos.advice})` }} /><div className="hero-note"><span className="note-icon"><Sparkles size={16} /></span><div><strong>Banking with perspective</strong><small>Personal advice for every season.</small></div></div><div className="hero-stat"><span>Since 1902</span><strong>Here for the long view.</strong></div></div></section><section className="statement" id="why-us"><div><p className="eyebrow">A better balance</p><h2 className="font-display">Your money should work as hard as you do.</h2></div><p>Simple products are important. So is having someone who remembers your name, understands your goals, and helps you make confident decisions along the way.</p></section><section className="products-section" id="products"><div className="section-header"><div><p className="eyebrow">Find your next step</p><h2 className="font-display">Products that fit real life.</h2></div><p>Choose a path and tell us what you’re working toward. We’ll take it from there.</p></div><div className="product-grid">{products.map((product) => <button key={product.title} className="product-card" onClick={() => onContact(product.interest)}><div className="product-image" style={{ backgroundImage: `url(${product.image})` }}><span className="product-arrow"><ArrowUpRight size={17} /></span></div><div className="product-copy"><p className="eyebrow">{product.interest}</p><h3 className="font-display">{product.title}</h3><p>{product.copy}</p><span className="product-link">Talk with a banker <ArrowRight size={15} /></span></div></button>)}</div></section><section className="banking-banner"><div><p className="eyebrow text-gold">Banking, your way</p><h2 className="font-display">The confidence to make your next move.</h2><p>Keep your everyday banking close, your savings growing, and your bigger goals in sight with one team behind you.</p></div><button className="gold-button" onClick={() => onContact('Savings account')}>Meet your banking team <ArrowRight size={16} /></button></section></main><footer className="site-footer" id="contact"><div className="footer-main"><div><Brand /><p className="mt-5 max-w-xs text-sm leading-6 text-white/60">A community bank for the life you’re building.</p></div><div><p className="footer-label">Explore</p><a href="#products">Personal banking</a><a href="#products">Loans</a><a href="#products">Credit cards</a></div><div><p className="footer-label">Visit or call</p><p>120 Main Street</p><p>Abingdon, VA 24210</p><a href="tel:2765550147">(276) 555-0147</a><a href="mailto:hello@firstbanktrust.com">hello@firstbanktrust.com</a></div></div><div className="footer-bottom"><span>© 2026 First Bank &amp; Trust · Member FDIC · Equal Housing Lender</span><span>Privacy · Security · Accessibility</span></div></footer></div>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <div><label className="field-label">{label}</label><input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} /></div>;
}

function TopBar({ view, setView, onLogout, profile }: { view: View; setView: (view: View) => void; onLogout: () => void; profile: UserProfile | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Bell items point at a customer screen, or (for admins) at a section of the staff workspace.
  const goTo = (target: string) => {
    if (profile?.role === 'admin') document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else setView(target as View);
  };
  return <header className="topbar"><div className="flex items-center gap-4"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu"><Menu size={20} /></button><button onClick={() => setView(profile?.role === 'admin' ? 'admin' : 'dashboard')} className="hidden sm:block"><Brand compact /></button></div><div className="hidden items-center gap-2 text-xs text-slate-500 md:flex"><LockKeyhole size={13} className="text-forest" /> {profile ? (profile.role === 'admin' ? 'Staff access' : `@${profile.username} · ${profile.country}`) : 'Secure session'}</div><div className="relative flex items-center gap-3">{profile && <NotificationBell role={profile.role} onNavigate={goTo} />}<button className="flex items-center gap-2" onClick={() => setMenuOpen(!menuOpen)}><Avatar name={profile?.name} /><span className="hidden text-sm font-medium text-ink sm:block">{profile?.name ?? ''}</span><ChevronDown size={15} className="text-slate-400" /></button>{menuOpen && <div className="dropdown">{profile?.role === 'admin' ? <button onClick={() => { setMenuOpen(false); setView('admin'); }}><BriefcaseBusiness size={15} /> Staff workspace</button> : <><button onClick={() => { setMenuOpen(false); setView('dashboard'); }}><HomeIcon size={15} /> Overview</button><button onClick={() => { setMenuOpen(false); setView('profile'); }}><UserRound size={15} /> Profile &amp; settings</button><button onClick={() => { setMenuOpen(false); setView('messages'); }}><MessageSquare size={15} /> Messages</button><button onClick={() => { setMenuOpen(false); setView('help'); }}><HelpCircle size={15} /> Help center</button></>}<button onClick={onLogout}><LogOut size={15} /> Sign out</button></div>}</div></header>;
}

function SideNav({ view, setView, unread }: { view: View; setView: (view: View) => void; unread: number }) {
  const links: { label: string; icon: typeof HomeIcon; view: View }[] = [{ label: 'Overview', icon: HomeIcon, view: 'dashboard' }, { label: 'Transactions', icon: Receipt, view: 'transactions' }, { label: 'Transfer money', icon: Send, view: 'transfer' }, { label: 'Deposit', icon: ArrowDownToLine, view: 'deposit' }, { label: 'Pay', icon: WalletCards, view: 'pay' }];
  return <aside className="hidden w-60 shrink-0 flex-col border-r border-stone-200 bg-white px-5 py-7 lg:flex"><Brand compact /><p className="mt-14 mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Your banking</p><nav className="space-y-1">{links.map(({ label, icon: Icon, view: linkView }) => <button key={label} onClick={() => setView(linkView)} className={`nav-link ${view === linkView ? 'active' : ''}`}><Icon size={18} />{label}</button>)}</nav><p className="mb-4 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Support</p><button onClick={() => setView('messages')} className={`nav-link ${view === 'messages' ? 'active' : ''}`}><MessageSquare size={18} />Messages{unread > 0 && <span className="ml-auto rounded-full bg-[#c4874b] px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>}</button><button onClick={() => setView('help')} className={`nav-link ${view === 'help' ? 'active' : ''}`}><HelpCircle size={18} />Help center</button><button onClick={() => setView('profile')} className={`nav-link ${view === 'profile' ? 'active' : ''}`}><Settings size={18} />Profile &amp; settings</button><div className="mt-auto rounded-2xl bg-forest p-4 text-white"><Sparkles size={18} className="text-gold" /><p className="mt-3 text-sm font-medium">Need a hand?</p><p className="mt-1 text-xs leading-5 text-white/65">Your banker is available to help.</p><button onClick={() => setView('messages')} className="mt-4 text-xs font-semibold text-gold">Start a message →</button></div></aside>;
}

const cardFigure = (account: Account): { label: string; value: number } => {
  if (account.type === 'credit_card') return { label: 'Available credit', value: account.available };
  if (account.type === 'loan' || account.type === 'mortgage') return { label: 'Amount owed', value: Math.abs(account.balance) };
  if (account.type === 'ira') return { label: 'Current value', value: account.balance };
  return { label: 'Available balance', value: account.available };
};

function AccountCard({ account, active, onSelect }: { account: Account; active: boolean; onSelect: () => void }) {
  return <button onClick={onSelect} className={`account-card ${active ? 'active' : ''}`}><div className="flex items-start justify-between"><div><p className="text-sm text-white/75">{account.name}</p><p className="mt-1 text-xs text-white/55">{account.number}</p></div><CreditCard size={20} className="text-gold" /></div><div className="mt-10"><p className="text-[11px] uppercase tracking-[0.17em] text-white/50">{cardFigure(account).label}</p><p className="mt-1 text-3xl font-medium tracking-tight">{formatMoney(Math.abs(cardFigure(account).value), account.currency)}</p></div><div className="mt-4 flex items-center justify-between text-xs text-white/60"><span>{ACCOUNT_TYPE_LABELS[account.type] ?? account.type} · {account.currency}</span><ArrowUpRight size={15} /></div></button>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Send; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="quick-action"><span><Icon size={21} /></span><small>{label}</small></button>;
}

function TransactionRow({ transaction, compact = false }: { transaction: Transaction; compact?: boolean }) {
  const positive = transaction.amount > 0;
  return <div className={`transaction-row ${compact ? 'compact' : ''}`}><div className="transaction-icon"><Receipt size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{transaction.merchant}</p><p className="mt-1 truncate text-xs text-slate-500">{transaction.detail}</p>{transaction.note && <p className="mt-2 flex items-center gap-1 text-xs text-forest"><FileText size={13} />{transaction.note}</p>}</div><div className="text-right"><p className={`text-sm font-medium ${positive ? 'text-forest' : 'text-ink'}`}>{positive ? '+' : ''}{formatMoney(transaction.amount, transaction.currency ?? 'USD')}</p>{transaction.status && <span className={`status-pill ${transaction.status.toLowerCase()}`}>{transaction.status}</span>}</div></div>;
}

function Dashboard({ setView, transactions, accounts, loading, profile }: { setView: (view: View) => void; transactions: Transaction[]; accounts: Account[]; loading: boolean; profile: UserProfile }) {
  const [activeAccount, setActiveAccount] = useState(0);
  const account = accounts.length ? (accounts[Math.min(activeAccount, accounts.length - 1)] ?? accounts[0]) : null;
  const currency = account?.currency ?? getCountry(profile.country).currency;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.name.split(' ')[0];
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">{greeting}, {firstName}.</h1><p className="mt-2 text-sm text-slate-500">Here’s your financial snapshot.</p></div><button className="outline-button" onClick={() => setView('help')}><HelpCircle size={16} /> Help center</button></div><div className="mt-9 grid gap-5 xl:grid-cols-[1.6fr_1fr]"><section><div className="mb-3 flex items-center justify-between"><h2 className="section-title">Accounts</h2></div><div className="account-scroll">{loading ? <p className="px-2 py-6 text-sm text-slate-500">Loading your accounts…</p> : accounts.length === 0 ? <p className="px-2 py-6 text-sm text-slate-500">No accounts yet. Your banker will set one up for you.</p> : accounts.map((item, index) => <AccountCard key={item.id} account={item} active={activeAccount === index} onSelect={() => setActiveAccount(index)} />)}</div><div className="mt-6 grid grid-cols-4 gap-3"><QuickAction icon={ArrowRight} label="Transfer" onClick={() => setView('transfer')} /><QuickAction icon={ArrowDownToLine} label="Deposit" onClick={() => setView('deposit')} /><QuickAction icon={WalletCards} label="Pay" onClick={() => setView('pay')} /><QuickAction icon={Receipt} label="Activity" onClick={() => setView('transactions')} /></div>{account && <AccountDetailPanel account={account} holder={profile.name} />}</section><SpendingCard transactions={transactions} currency={currency} loading={loading} /></div><section className="mt-10 rounded-3xl bg-white shadow-soft"><div className="flex items-center justify-between border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Recent transactions</h2><p className="mt-1 text-xs text-slate-500">{account ? `${account.name} · ${account.number}` : 'No account selected'}</p></div></div><div>{loading ? <p className="px-6 py-6 text-sm text-slate-500">Loading activity…</p> : transactions.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">No transactions yet.</p> : transactions.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} compact />)}</div><button className="see-more" onClick={() => setView('transactions')}>See all activity <ArrowRight size={15} /></button></section></div>;
}

type MoneyFilter = 'all' | 'in' | 'out';
const RANGE_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: '365', label: 'Last 12 months', days: 365 },
  { value: 'all', label: 'All time', days: null },
];

function Transactions({ transactions, setView, loading }: { transactions: Transaction[]; setView: (view: View) => void; loading: boolean }) {
  const [direction, setDirection] = useState<MoneyFilter>('all');
  const [range, setRange] = useState('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [visible, setVisible] = useState(80);
  const filtered = useMemo(() => {
    const days = RANGE_OPTIONS.find((option) => option.value === range)?.days ?? null;
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : null;
    const needle = query.trim().toLowerCase();
    return transactions.filter((item) => {
      if (direction === 'in' && !(item.amount > 0)) return false;
      if (direction === 'out' && !(item.amount < 0)) return false;
      if (cutoff !== null && (item.timestamp ?? 0) < cutoff) return false;
      if (needle && !`${item.merchant} ${item.category} ${item.note ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [transactions, direction, range, query]);
  const grouped = useMemo(() => filtered.slice(0, visible).reduce<Record<string, Transaction[]>>((result, transaction) => { (result[transaction.date] ||= []).push(transaction); return result; }, {}), [filtered, visible]);
  const filtersOn = direction !== 'all' || range !== 'all' || query.trim() !== '';
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Your activity</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Transactions</h1></div><button className="outline-button" onClick={() => setView('transfer')}><Send size={16} /> Make a transfer</button></div><div className="mt-8 flex flex-wrap items-center gap-2"><button className={`filter-pill ${direction === 'all' ? 'active' : ''}`} onClick={() => setDirection('all')}>All activity</button><button className={`filter-pill ${direction === 'in' ? 'active' : ''}`} onClick={() => setDirection('in')}>Money in</button><button className={`filter-pill ${direction === 'out' ? 'active' : ''}`} onClick={() => setDirection('out')}>Money out</button><label className="filter-pill relative cursor-pointer"><select aria-label="Date range" className="cursor-pointer appearance-none bg-transparent pr-5 outline-none" value={range} onChange={(event) => setRange(event.target.value)}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3" /></label><button className={`filter-pill ml-auto ${searching || query ? 'active' : ''}`} onClick={() => setSearching(!searching)}><Search size={14} /> Search</button></div>{(searching || query) && <input autoFocus className="field-input mt-3 max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, category or note" />}{loading ? <p className="mt-8 text-sm text-slate-500">Loading activity…</p> : transactions.length === 0 ? <p className="mt-8 text-sm text-slate-500">No transactions yet.</p> : filtered.length === 0 ? <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-soft"><p className="text-sm text-slate-600">No transactions match these filters.</p>{filtersOn && <button className="outline-button mx-auto mt-4" onClick={() => { setDirection('all'); setRange('all'); setQuery(''); }}>Clear filters</button>}</div> : <><p className="mt-6 text-xs text-slate-500">Showing {filtered.length} of {transactions.length} transactions</p><div className="mt-3 space-y-7">{Object.entries(grouped).map(([date, items]) => <div key={date}><h2 className="mb-3 text-sm font-semibold text-slate-600">{date}</h2><div className="overflow-hidden rounded-3xl bg-white shadow-soft">{items.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</div></div>)}</div>{filtered.length > visible && <button className="outline-button mx-auto mt-6" onClick={() => setVisible(visible + 120)}>Show more ({filtered.length - visible} older)</button>}</>}</div>;
}
function Profile({ setView, profile }: { setView: (view: View) => void; profile: UserProfile }) {
  const country = getCountry(profile.country);
  const rows: { label: string; value: string }[] = [
    { label: 'Full name', value: profile.name },
    { label: 'Username', value: `@${profile.username}` },
    { label: 'Email address', value: profile.email },
    { label: 'Phone number', value: profile.phone || 'Not on file' },
    { label: 'Country', value: country.name },
    { label: 'Account currency', value: country.currency },
  ];
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Your profile</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Profile &amp; settings</h1><p className="mt-2 text-sm text-slate-500">Your details as held by First Bank &amp; Trust.</p></div><button className="outline-button" onClick={() => setView('dashboard')}><ArrowLeft size={16} /> Back to overview</button></div><div className="mt-8 grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-3xl bg-forest p-8 text-white"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#d8e4d8] text-2xl font-bold text-forest">{profile.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</div><h2 className="font-display mt-6 text-3xl">{profile.name}</h2><p className="mt-2 text-sm text-white/65">@{profile.username} · {country.name}</p></section><section className="rounded-3xl bg-white p-6 shadow-soft md:p-8"><p className="eyebrow">Personal information</p><h2 className="font-display mt-2 text-3xl text-forest">Your details.</h2><div className="mt-8 grid gap-5 md:grid-cols-2">{rows.map((row) => <div key={row.label}><label className="field-label">{row.label}</label><input className="field-input" value={row.value} readOnly /></div>)}</div><p className="mt-6 rounded-xl bg-cream px-4 py-3 text-xs leading-5 text-slate-600">To change your name, email, phone or country, please contact your banker.</p></section></div></div>;
}
function Admin({ setView }: { setView: (view: View) => void }) {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Codes revealed for display, keyed by userId (shown once after generation).
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('United States');
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [createNotice, setCreateNotice] = useState('');

  const [reviewStatus, setReviewStatus] = useState<'Pending' | 'Complete' | 'Cancelled'>('Pending');
  const [reviewNote, setReviewNote] = useState('');

  const [historyNote, setHistoryNote] = useState('');
  const [historyMerchant, setHistoryMerchant] = useState('');
  const [historyAmount, setHistoryAmount] = useState('');
  const [historyDirection, setHistoryDirection] = useState<'in' | 'out'>('out');
  const [actionNotice, setActionNotice] = useState('');
  const [historyStatus, setHistoryStatus] = useState<'complete' | 'pending'>('complete');
  // The selected customer's full history (including hidden rows) and the cross-customer approval queue.
  const [userTxns, setUserTxns] = useState<AdminTxn[]>([]);
  const [pendingQueue, setPendingQueue] = useState<AdminTxn[]>([]);
  const [txnDrafts, setTxnDrafts] = useState<Record<string, { status: string; note: string }>>({});

  // Per-account balance draft inputs, keyed by account id.
  const [balanceDrafts, setBalanceDrafts] = useState<Record<string, string>>({});

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { customers: loaded } = await apiGet<{ customers: AdminCustomer[] }>('/api/admin/list-customers');
      setCustomers(loaded);
      setSelectedId((current) => current || (loaded[0]?.id ?? ''));
    } catch (err) {
      setLoadError((err as Error).message || 'Could not load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const loadPending = useCallback(async () => {
    try {
      const { transactions } = await apiGet<{ transactions: AdminTxn[] }>('/api/admin/list-transactions?pending=1');
      setPendingQueue(transactions);
    } catch { /* surfaced via loadError on customers; queue just stays empty */ }
  }, []);

  const loadUserTxns = useCallback(async (userId: string) => {
    if (!userId) { setUserTxns([]); return; }
    try {
      const { transactions } = await apiGet<{ transactions: AdminTxn[] }>(`/api/admin/list-transactions?userId=${encodeURIComponent(userId)}`);
      setUserTxns(transactions);
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not load history.');
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);
  useEffect(() => { loadUserTxns(selectedId); }, [selectedId, loadUserTxns]);

  const draftFor = (txn: AdminTxn) => txnDrafts[txn.id] ?? { status: txn.status, note: txn.admin_description ?? txn.note ?? '' };
  const setDraft = (txn: AdminTxn, patch: Partial<{ status: string; note: string }>) => setTxnDrafts((current) => ({ ...current, [txn.id]: { ...draftFor(txn), ...patch } }));

  const saveTxn = async (txn: AdminTxn) => {
    const draft = draftFor(txn);
    setActionNotice('');
    try {
      await apiPost('/api/admin/review-transaction', { transactionId: txn.id, status: draft.status, note: draft.note });
      setTxnDrafts((current) => { const next = { ...current }; delete next[txn.id]; return next; });
      await Promise.all([loadPending(), loadUserTxns(selectedId)]);
      setActionNotice(`Saved: ${txn.merchant} is now ${draft.status}.`);
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not save the review.');
    }
  };

  const removeTxn = async (txn: AdminTxn) => {
    setActionNotice('');
    try {
      await apiPost('/api/admin/review-transaction', { transactionId: txn.id, remove: true });
      await Promise.all([loadPending(), loadUserTxns(selectedId)]);
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not remove the entry.');
    }
  };

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const seededRows = userTxns.filter((txn) => txn.source === 'seed');
  const seededVisible = seededRows.length > 0 && seededRows.some((txn) => !txn.is_hidden);
  const staffRows = userTxns.filter((txn) => txn.source !== 'seed');

  const allAccounts = useMemo(() => customers.flatMap((customer) => customer.accounts), [customers]);
  const fundsByCurrency = allAccounts.reduce<Record<string, number>>((totals, account) => { totals[account.currency] = (totals[account.currency] ?? 0) + Number(account.balance || 0); return totals; }, {});
  const fundsLabel = Object.keys(fundsByCurrency).length === 0 ? formatMoney(0) : Object.entries(fundsByCurrency).map(([currency, total]) => formatMoney(total, currency)).join(' + ');

  const generateCodeFor = async (userId: string) => {
    setActionNotice('');
    try {
      const { code } = await apiPost<{ code: string }>('/api/admin/generate-code', { userId });
      setCodes((current) => ({ ...current, [userId]: code }));
      await loadCustomers();
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not generate a code.');
    }
  };

  const createCustomer = async () => {
    const cleanUser = username.trim().toLowerCase();
    if (!name || !cleanUser || !password) { setCreateNotice('Name, username, and temporary password are required.'); return; }
    setCreateNotice('');
    try {
      await apiPost('/api/admin/create-customer', { name, username: cleanUser, password, country, email: email || undefined, phone: phone || undefined });
      setName(''); setEmail(''); setPhone(''); setUsername(''); setPassword(''); setShowCreate(false);
      await loadCustomers();
    } catch (err) {
      setCreateNotice((err as Error).message || 'Could not create the customer.');
    }
  };

  const applyBalance = async (accountId: string) => {
    if (!selected) return;
    const raw = balanceDrafts[accountId];
    if (raw === undefined || raw === '') return;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    setActionNotice('');
    try {
      await apiPost('/api/admin/set-balance', { userId: selected.id, accountId, balance: parsed });
      setBalanceDrafts((current) => ({ ...current, [accountId]: '' }));
      await loadCustomers();
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not update the balance.');
    }
  };

  const changeCountry = async (nextCountry: string) => {
    if (!selected || nextCountry === selected.country) return;
    const nextCurrency = getCountry(nextCountry).currency;
    if (!window.confirm(`Switch ${selected.display_name} to ${nextCountry}? Their accounts and history will be shown in ${nextCurrency}.`)) return;
    setActionNotice('');
    try {
      await apiPost('/api/admin/update-customer', { userId: selected.id, country: nextCountry });
      await Promise.all([loadCustomers(), loadUserTxns(selected.id)]);
      setActionNotice(`${selected.display_name} now banks in ${nextCountry} (${nextCurrency}).`);
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not change the country.');
    }
  };

  const saveHistoryEntry = async () => {
    if (!selected) { setActionNotice('Select a customer first.'); return; }
    const parsedAmount = Number(historyAmount);
    if (!historyMerchant || !(parsedAmount > 0)) { setActionNotice('Enter a merchant and a positive amount.'); return; }
    setActionNotice('');
    try {
      await apiPost('/api/admin/add-history', { userId: selected.id, merchant: historyMerchant, amount: parsedAmount, direction: historyDirection, note: historyNote || undefined, status: historyStatus });
      setHistoryMerchant(''); setHistoryAmount(''); setHistoryNote('');
      await loadUserTxns(selected.id);
      setActionNotice('History entry added. Add as many as you need.');
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not add the history entry.');
    }
  };

  const seedHistory = async () => {
    if (!selected) { setActionNotice('Select a customer first.'); return; }
    setActionNotice('');
    try {
      // Toggle: hides the pre-built history if it is showing, shows (or first-time builds) it otherwise.
      const visible = !seededVisible;
      await apiPost('/api/admin/toggle-history', { userId: selected.id, visible });
      await loadUserTxns(selected.id);
      setActionNotice(visible ? `Pre-built history is now visible to ${selected.display_name}.` : `Pre-built history is now hidden from ${selected.display_name}.`);
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not update the history.');
    }
  };

  const regenerateHistory = async () => {
    if (!selected) return;
    if (!window.confirm(`Replace ${selected.display_name}'s pre-built history with a brand new one? Entries you added yourself are kept.`)) return;
    setActionNotice('Building a new history…');
    try {
      const result = await apiPost<{ added: number }>('/api/admin/toggle-history', { userId: selected.id, regenerate: true });
      await loadUserTxns(selected.id);
      setActionNotice(`Built ${result.added} new transactions covering the last 5 years.`);
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not rebuild the history.');
    }
  };

  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Staff workspace</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Welcome back.</h1><p className="mt-2 text-sm text-slate-500">Manage customers, accounts, history, and transfer reviews.</p></div><button className="outline-button" onClick={() => setView('landing')}><X size={16} /> Exit staff view</button></div><div className="admin-metrics mt-8"><div className="metric-card"><UsersRound size={19} /><span>Customers</span><strong>{customers.length}</strong><small>Active profiles</small></div><div className="metric-card"><Send size={19} /><span>Pending transfers</span><strong>{String(pendingQueue.length).padStart(2, '0')}</strong><small className="text-gold">{pendingQueue.length ? 'Needs review' : 'All clear'}</small></div><div className="metric-card"><WalletCards size={19} /><span>Funds managed</span><strong>{fundsLabel}</strong><small>Across {allAccounts.length} visible accounts</small></div></div>{loadError && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}<div className="admin-grid mt-8"><section className="rounded-3xl bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Customer management</h2><p className="mt-1 text-xs text-slate-500">Issue usernames, passwords, and fresh access codes.</p></div><button className="primary-button" onClick={() => setShowCreate(!showCreate)}><Plus size={16} /> Add customer</button></div>{showCreate && <div className="border-b border-stone-100 bg-cream/60 p-6"><div className="grid gap-3 md:grid-cols-2"><input className="field-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer name" /><input className="field-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" /><input className="field-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" type="tel" /><div className="md:col-span-2"><label className="field-label">Country this customer banks in *</label><select className="field-input" value={country} onChange={(event) => setCountry(event.target.value)}>{COUNTRY_NAMES.map((name) => <option key={name} value={name}>{name} · {getCountry(name).currency}</option>)}</select><p className="mt-1.5 text-xs leading-5 text-slate-500">Sets the customer’s currency, transfer details and deposit methods ({getCountry(country).rail}, {getCountry(country).currency}).</p></div><input className="field-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Banking username" /><input className="field-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password" type="password" /><button className="primary-button md:w-fit" onClick={createCustomer}>Create profile</button></div>{createNotice && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{createNotice}</p>}<p className="mt-3 text-xs text-slate-500">After creating the profile, send a fresh access code before the first login.</p></div>}<div className="divide-y divide-stone-100">{loading ? <p className="px-6 py-6 text-sm text-slate-500">Loading customers…</p> : customers.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">No customers yet. Add one to get started.</p> : customers.map((customer) => { const accountSummary = customer.accounts.length ? customer.accounts.map((account) => `${account.name} · ${account.masked_number}`).join(', ') : 'Not assigned'; const revealed = codes[customer.id]; return <div key={customer.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div className="flex items-center gap-3"><Avatar name={customer.display_name || customer.username} /><div><p className="text-sm font-medium">{customer.display_name || customer.username}</p><p className="mt-1 text-xs text-slate-500">{customer.email} · @{customer.username} · {customer.country} ({getCountry(customer.country).currency}) · {accountSummary}</p>{revealed && <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#edf4ed] px-3 py-1 text-xs font-bold tracking-[.3em] text-forest"><LockKeyhole size={12} /> {revealed}</p>}{!revealed && customer.hasActiveCode && <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#edf4ed] px-3 py-1 text-xs font-semibold text-forest"><LockKeyhole size={12} /> Active code issued</p>}</div></div><div className="flex items-center gap-4"><button className="text-xs font-bold text-forest" onClick={() => generateCodeFor(customer.id)}>{customer.hasActiveCode ? 'New code' : 'Generate code'}</button><span className={`status-pill ${(customer.status || 'active').toLowerCase()}`}>{customer.status || 'Active'}</span></div></div>; })}</div></section><section className="rounded-3xl bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Accounts &amp; balances</h2><p className="mt-1 text-xs text-slate-500">Open checking, savings, money market, credit card, IRA, loan or mortgage accounts, and set balances.</p></div><button className="outline-button" onClick={() => setShowAccountForm(!showAccountForm)} disabled={!selected}><Plus size={16} /> {showAccountForm ? 'Close' : 'Open account'}</button></div>{showAccountForm && selected && <AdminAccountForm customer={selected} onCreated={loadCustomers} />}<div className="border-b border-stone-100 bg-cream/60 p-6"><label className="field-label">Editing customer</label><select className="field-input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{customers.length === 0 && <option value="">No customers</option>}{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name || customer.username} · @{customer.username}</option>)}</select><p className="mt-2 text-xs text-slate-500">Balances and history entries below apply to this customer.</p>{selected && <div className="mt-4"><label className="field-label">Customer’s country and currency</label><select className="field-input" value={selected.country} onChange={(event) => changeCountry(event.target.value)}>{COUNTRY_NAMES.map((name) => <option key={name} value={name}>{name} · {getCountry(name).currency}</option>)}</select><p className="mt-1.5 text-xs leading-5 text-slate-500">Decides their currency, transfer details and deposit methods.</p></div>}</div><div className="divide-y divide-stone-100">{!selected ? <p className="px-6 py-6 text-sm text-slate-500">Select a customer to manage their accounts.</p> : selected.accounts.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">No accounts yet. Use “Open account” to create one.</p> : selected.accounts.map((account) => { const debt = isDebt(account.type); const d = account.details ?? {}; return <div key={account.id} className="px-6 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-sm font-medium text-ink">{account.name}</span><span className="ml-2 text-xs text-slate-500">{account.masked_number} · {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</span>{account.type === 'credit_card' && d.cardNumber && <p className="mt-1 break-words font-mono text-xs text-slate-600">{d.network} {formatCardNumber(String(d.cardNumber))} · exp {d.expiry} · limit {formatMoney(Number(d.creditLimit || 0), account.currency)} · {d.apr}% APR</p>}{(account.type === 'loan' || account.type === 'mortgage') && <p className="mt-1 text-xs text-slate-600">{account.type === 'loan' ? d.loanType : d.propertyAddress} · {d.interestRate}% · {formatMoney(Number(d.monthlyPayment || 0), account.currency)}/mo · next due {d.nextPaymentDate}</p>}{account.type === 'ira' && <p className="mt-1 text-xs text-slate-600">{d.iraType} IRA · contributed {formatMoney(Number(d.contributionsThisYear || 0), account.currency)} of {formatMoney(Number(d.contributionLimit || 0), account.currency)}</p>}{(account.type === 'money_market' || account.type === 'savings') && d.apy !== undefined && <p className="mt-1 text-xs text-slate-600">{d.apy}% APY</p>}</div><span className="shrink-0 text-sm font-semibold text-forest">{debt ? `Owes ${formatMoney(Math.abs(Number(account.balance || 0)), account.currency)}` : formatMoney(Number(account.balance || 0), account.currency)}</span></div><div className="mt-3 flex items-center gap-2"><div className="relative flex-1"><span className="absolute left-3 top-3 text-[11px] font-bold text-slate-400">{account.currency}</span><input className="field-input pl-14" value={balanceDrafts[account.id] ?? ''} onChange={(event) => setBalanceDrafts((current) => ({ ...current, [account.id]: event.target.value.replace(/[^0-9.-]/g, '') }))} inputMode="decimal" placeholder={debt ? 'Set new amount owed' : 'Set new balance'} /></div><button className="outline-button" onClick={() => applyBalance(account.id)}><Check size={15} /> Set</button></div></div>; })}</div><div className="border-t border-stone-100 p-6"><div className="flex items-center justify-between gap-3"><p className="field-label mb-0">Transaction history</p><div className="flex flex-wrap items-center gap-2">{seededRows.length > 0 && <button className="outline-button" onClick={regenerateHistory}>Rebuild</button>}<button className="gold-button" onClick={seedHistory}><FileText size={15} /> {seededVisible ? 'Hide pre-built history' : seededRows.length ? 'Show pre-built history' : 'Auto-fill history'}</button></div></div><p className="mt-2 mb-4 text-xs text-slate-500">Auto-fill builds about five years of varied transactions, including large wire movements, up to today. Each customer gets a different randomised history. Toggle it on or off for this customer, and add as many individual entries as you want.</p><div className="grid gap-3 sm:grid-cols-[1fr_140px_120px]"><input className="field-input" value={historyMerchant} onChange={(event) => setHistoryMerchant(event.target.value)} placeholder="Bank or provider" /><input className="field-input" value={historyAmount} onChange={(event) => setHistoryAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder={`Amount (${selected ? getCountry(selected.country).currency : ''})`} inputMode="decimal" /><select className="field-input" value={historyDirection} onChange={(event) => setHistoryDirection(event.target.value as 'in' | 'out')}><option value="out">Money out</option><option value="in">Money in</option></select></div><div className="mt-3 flex items-center gap-2"><label className="field-label mb-0">Status</label><select className="field-input max-w-[160px]" value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value as 'complete' | 'pending')}><option value="complete">Completed</option><option value="pending">Pending</option></select></div><textarea className="field-input mt-3 min-h-20" value={historyNote} onChange={(event) => setHistoryNote(event.target.value)} placeholder="Add a detailed note to this payment or historical wire" /><button className="outline-button mt-3" onClick={saveHistoryEntry}><Plus size={15} /> Save history entry</button>{actionNotice && <p className="mt-3 rounded-xl bg-[#edf4ed] px-4 py-2 text-xs text-forest">{actionNotice}</p>}{selected && <div className="mt-6"><p className="field-label">Entries for {selected.display_name} ({staffRows.length}{seededRows.length ? ` + ${seededRows.length} pre-built ${seededVisible ? 'shown' : 'hidden'}` : ''})</p>{staffRows.length === 0 ? <p className="text-xs text-slate-500">No individual entries yet.</p> : <div className="max-h-96 space-y-3 overflow-y-auto">{staffRows.map((txn) => { const draft = draftFor(txn); return <div key={txn.id} className="rounded-xl border border-stone-100 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{txn.merchant}</p><p className="text-xs text-slate-500">{formatMoney(Number(txn.amount), txn.currency)} · {txn.source === 'customer' ? 'Customer transfer' : 'Staff entry'}</p></div><button className="text-xs font-bold text-red-700" onClick={() => removeTxn(txn)}>Remove</button></div><div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr_auto]"><select className="field-input" value={draft.status} onChange={(event) => setDraft(txn, { status: event.target.value })}><option value="pending">Pending</option><option value="complete">Completed</option><option value="cancelled">Cancelled</option></select><input className="field-input" value={draft.note} onChange={(event) => setDraft(txn, { note: event.target.value })} placeholder="Note shown to customer" /><button className="outline-button" onClick={() => saveTxn(txn)}><Check size={14} /> Save</button></div></div>; })}</div>}</div>}</div></section></div><section id="review-queue" className="mt-8 scroll-mt-24 rounded-3xl bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Transfer review queue</h2><p className="mt-1 text-xs text-slate-500">Customer transfers stay pending until you approve, complete, or cancel them.</p></div><span className="status-pill pending">{pendingQueue.length} pending</span></div><div className="grid gap-6 p-6 lg:grid-cols-2">{pendingQueue.length === 0 ? <p className="text-sm text-slate-500 lg:col-span-2">No transfers are waiting for review.</p> : pendingQueue.map((txn) => { const draft = draftFor(txn); return <div key={txn.id} className="rounded-2xl bg-cream p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">{txn.merchant}</p><p className="mt-1 text-xs text-slate-500">{txn.category} · {txn.customer_name} · {txn.institution_name ?? 'Bank'}{txn.transfer_country ? ` · ${txn.transfer_country}` : ''}</p></div><p className="text-lg font-medium text-ink">{formatMoney(Math.abs(Number(txn.amount)), txn.currency)}</p></div>{(txn.counterparty_email || txn.counterparty_phone || (txn.payment_details && Object.keys(txn.payment_details).length > 0)) && <dl className="mt-4 grid gap-x-4 gap-y-2 rounded-xl bg-white/70 p-3 text-xs text-slate-600 sm:grid-cols-2">{Object.entries(txn.payment_details ?? {}).map(([key, value]) => <div key={key}><dt className="font-semibold capitalize text-slate-500">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt><dd className="break-all">{String(value)}</dd></div>)}{txn.counterparty_email && <div><dt className="font-semibold text-slate-500">email</dt><dd className="break-all">{txn.counterparty_email}</dd></div>}{txn.counterparty_phone && <div><dt className="font-semibold text-slate-500">phone</dt><dd>{txn.counterparty_phone}</dd></div>}</dl>}<textarea className="field-input mt-5 min-h-24 bg-white" value={draft.note} onChange={(event) => setDraft(txn, { note: event.target.value })} placeholder="Add a detailed approval, completion, or cancellation note" /><div className="mt-4 flex flex-wrap items-center gap-2"><select className="field-input max-w-[160px]" value={draft.status} onChange={(event) => setDraft(txn, { status: event.target.value })}><option value="pending">Pending</option><option value="complete">Completed</option><option value="cancelled">Cancelled</option></select><button className="primary-button" onClick={() => saveTxn(txn)}>Save review</button></div></div>; })}</div></section><AdminMessages customers={customers} onChanged={() => undefined} /></div>;
}

const VIEW_STORAGE_KEY = 'fbt-view';
const CUSTOMER_VIEWS: View[] = ['dashboard', 'transactions', 'transfer', 'deposit', 'pay', 'messages', 'help', 'profile'];
const CODE_WINDOW_MS = 24 * 60 * 60 * 1000;

const toProfile = (row: any): UserProfile => ({
  name: row.display_name || row.username || 'Customer',
  username: row.username ?? '',
  email: row.email ?? '',
  phone: row.phone ?? '',
  country: row.country ?? 'United States',
  role: row.role === 'admin' ? 'admin' : 'customer',
});

export default function Home() {
  const [view, setView] = useState<View>('landing');
  const [contactInterest, setContactInterest] = useState('Checking account');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!supabase) return;
    const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender', 'staff').is('read_at', null);
    setUnreadMessages(count ?? 0);
  }, []);

  const loadCustomerData = useCallback(async () => {
    if (!supabase) { setDataLoading(false); return; }
    setDataLoading(true);
    // The database returns at most 1000 rows per request, so read the history page by page.
    // Five years of seeded history can be several thousand rows, so keep paging until a short page.
    const fetchAllTransactions = async () => {
      const rows: any[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        const { data } = await supabase!.from('transactions').select('*').order('transaction_date', { ascending: false }).order('id', { ascending: true }).range(from, from + 999);
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    };
    const [{ data: accountRows }, txnRows] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at'),
      fetchAllTransactions(),
    ]);
    const mappedAccounts: Account[] = (accountRows ?? []).map((row: any) => ({
      id: String(row.id),
      name: row.name,
      number: row.masked_number,
      type: row.type,
      balance: Number(row.balance ?? 0),
      available: Number(row.available_balance ?? row.balance ?? 0),
      currency: row.currency ?? 'USD',
      details: row.details ?? {},
    }));
    const mappedTransactions: Transaction[] = txnRows.map((row: any) => ({
      id: String(row.id),
      merchant: row.merchant,
      detail: `${row.category ?? 'Activity'} · ${formatTxnDate(row.transaction_date)}`,
      amount: Number(row.amount ?? 0),
      date: formatTxnDate(row.transaction_date),
      category: row.category ?? 'Activity',
      status: dbStatusToLabel(row.status),
      note: row.note ?? undefined,
      timestamp: row.transaction_date ? new Date(row.transaction_date).getTime() : 0,
      currency: row.currency ?? 'USD',
    }));
    setAccounts(mappedAccounts);
    setTransactions(mappedTransactions);
    setDataLoading(false);
  }, []);

  // Load who is signed in (name, country, role) for the current session.
  const loadProfileForSession = useCallback(async (): Promise<UserProfile | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    const { data: row } = await supabase.from('profiles').select('display_name, username, email, phone, role, country').eq('id', userId).single();
    if (!row) return null;
    const loaded = toProfile(row);
    setProfile(loaded);
    return loaded;
  }, []);

  // On first load, resume an existing session (no flash of the home page for signed-in users).
  useEffect(() => {
    let active = true;
    const resume = async () => {
      if (!supabase) { if (active) setSessionChecked(true); return; }
      // Nothing stored on this device => show the public website immediately.
      const hasStoredSession = Object.keys(window.localStorage).some((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
      if (!hasStoredSession) { setSessionChecked(true); return; }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const session = data.session;
      if (!session) { setSessionChecked(true); return; }
      const { data: row } = await supabase.from('profiles').select('display_name, username, email, phone, role, country, last_access_code_at').eq('id', session.user.id).single();
      if (!active) return;
      if (!row) { await supabase.auth.signOut(); setSessionChecked(true); return; }
      const me = toProfile(row);
      if (me.role === 'admin') {
        setProfile(me);
        setView('admin');
      } else {
        // Customers only resume if a banker-issued code was accepted in the last 24 hours.
        const lastCode = row.last_access_code_at ? new Date(row.last_access_code_at).getTime() : 0;
        if (Date.now() - lastCode < CODE_WINDOW_MS) {
          const saved = window.sessionStorage.getItem(VIEW_STORAGE_KEY) as View | null;
          setProfile(me);
          setView(saved && CUSTOMER_VIEWS.includes(saved) ? saved : 'dashboard');
          loadCustomerData();
        } else {
          await supabase.auth.signOut();
        }
      }
      setSessionChecked(true);
    };
    resume();
    return () => { active = false; };
  }, [loadCustomerData]);

  // Keep the unread-message badge fresh while a customer is signed in.
  useEffect(() => {
    if (!profile || profile.role !== 'customer') return;
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 20000);
    return () => window.clearInterval(timer);
  }, [profile, refreshUnread]);

  // Remember which screen a signed-in customer was on, so a reload stays put.
  useEffect(() => {
    if (!sessionChecked || !profile || profile.role !== 'customer') return;
    if (CUSTOMER_VIEWS.includes(view)) window.sessionStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view, profile, sessionChecked]);

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    window.sessionStorage.removeItem(VIEW_STORAGE_KEY);
    setAccounts([]);
    setTransactions([]);
    setProfile(null);
    setView('landing');
  };

  const enterDashboard = async () => { await loadProfileForSession(); setView('dashboard'); loadCustomerData(); };
  const enterAdmin = async () => { await loadProfileForSession(); setView('admin'); };
  const openContact = (interest: string) => { setContactInterest(interest); setView('contact'); };

  const splash = <div className="boot-splash" role="status" aria-label="Loading"><Brand /></div>;

  if (view === 'landing') return <>{!sessionChecked && splash}<Landing onLogin={() => setView('login')} onContact={openContact} /></>;
  if (view === 'login') return <Login onLogin={enterDashboard} onAdmin={enterAdmin} onBack={() => setView('landing')} />;
  if (view === 'contact') return <ContactForm interest={contactInterest} onBack={() => setView('landing')} />;
  if (!profile) return splash;

  const isAdmin = profile.role === 'admin';
  if (view === 'admin' || isAdmin) return <div className="app-frame"><TopBar view="admin" setView={setView} onLogout={logout} profile={profile} /><Admin setView={setView} /></div>;
  if (view === 'profile') return <div className="app-frame"><TopBar view={view} setView={setView} onLogout={logout} profile={profile} /><Profile setView={setView} profile={profile} /></div>;
  const nav: { label: string; icon: typeof HomeIcon; view: View }[] = [
    { label: 'Home', icon: HomeIcon, view: 'dashboard' },
    { label: 'Activity', icon: Receipt, view: 'transactions' },
    { label: 'Transfer', icon: Send, view: 'transfer' },
    { label: 'Deposit', icon: ArrowDownToLine, view: 'deposit' },
    { label: 'Pay', icon: WalletCards, view: 'pay' },
  ];
  return <div className="app-frame"><TopBar view={view} setView={setView} onLogout={logout} profile={profile} /><div className="flex min-h-[calc(100vh-73px)]"><SideNav view={view} setView={setView} unread={unreadMessages} /><main className="min-w-0 flex-1">{view === 'dashboard' && <Dashboard setView={setView} transactions={transactions} accounts={accounts} loading={dataLoading} profile={profile} />}{view === 'transactions' && <Transactions transactions={transactions} setView={setView} loading={dataLoading} />}{view === 'transfer' && <Transfer accounts={accounts.filter((a) => isSpendable(a.type))} profile={profile} onComplete={loadCustomerData} />}{view === 'deposit' && <Deposit accounts={accounts.filter((a) => canDepositTo(a.type))} profile={profile} onComplete={loadCustomerData} />}{view === 'pay' && <Pay accounts={accounts.filter((a) => isSpendable(a.type))} onComplete={loadCustomerData} />}{view === 'messages' && <Messages profile={profile} onRead={refreshUnread} />}{view === 'help' && <HelpCenter profile={profile} onMessage={() => setView('messages')} />}</main></div><nav className="bottom-nav lg:hidden">{nav.map(({ label, icon: Icon, view: target }) => <button key={label} className={view === target ? 'active' : ''} onClick={() => setView(target)}><Icon size={18} /><span>{label}</span></button>)}</nav></div>;
}
