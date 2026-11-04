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

type View = 'landing' | 'login' | 'contact' | 'dashboard' | 'transactions' | 'transfer' | 'profile' | 'admin';
type Transaction = {
  id: string | number;
  merchant: string;
  detail: string;
  amount: number;
  date: string;
  category: string;
  status?: 'Pending' | 'Complete' | 'Cancelled';
  note?: string;
};

type Account = {
  name: string;
  number: string;
  type: string;
  balance: number;
  available: number;
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
};

// A customer as returned by GET /api/admin/list-customers.
type AdminAccount = {
  id: string;
  name: string;
  type: string;
  masked_number: string;
  balance: number;
  available_balance: number;
};
type AdminCustomer = {
  id: string;
  display_name: string;
  email: string;
  username: string;
  role: string;
  status: string;
  accounts: AdminAccount[];
  hasActiveCode: boolean;
};

const historyMerchants = ['ATLANTIC ENERGY', 'ATM DEPOSIT', 'YOUR TOWN CINEMA', 'GEORGES BBQ & PUB', 'HOMETOWN MARKET', 'FIRST BANK MORTGAGE', 'NORTH STAR AIRLINES', 'BLUE RIDGE MEDICAL', 'WESTERN UNION WIRE', 'RIVERSTONE SUPPLY CO.'];
const wireDestinations = ['Canada', 'United Kingdom', 'Mexico', 'Germany', 'France', 'Australia', 'Japan', 'Brazil', 'Singapore', 'Switzerland'];
const historicTransactions: Transaction[] = Array.from({ length: 25 }, (_, monthIndex) => {
  const date = new Date(2024, 9, 1);
  date.setMonth(date.getMonth() + monthIndex);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return [
    { id: 1000 + monthIndex * 3, merchant: historyMerchants[monthIndex % historyMerchants.length], detail: `${month} 05, ${year} · Checking`, amount: -(5000 + ((monthIndex * 1731) % 44000)), date: `${month} ${year}`, category: 'Everyday banking' },
    { id: 1001 + monthIndex * 3, merchant: 'ATM DEPOSIT', detail: `${month} 14, ${year} · Savings`, amount: 5000 + ((monthIndex * 947) % 44000), date: `${month} ${year}`, category: 'Deposit' },
    { id: 1002 + monthIndex * 3, merchant: `WIRE · ${wireDestinations[monthIndex % wireDestinations.length]}`, detail: `${month} 24, ${year} · Money Market`, amount: -(50000 + ((monthIndex * 198734) % 24950000)), date: `${month} ${year}`, category: 'International wire', status: 'Complete' as const, note: `Received by partner bank in ${wireDestinations[monthIndex % wireDestinations.length]}.` },
  ];
}).flat();

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Format a DB transaction_date into a friendly "Mon, Nov 25" label.
const formatTxnDate = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

function Avatar({ name = 'Michael' }: { name?: string }) {
  return <div className="avatar">{name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div>;
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

function TopBar({ view, setView, onLogout }: { view: View; setView: (view: View) => void; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="topbar"><div className="flex items-center gap-4"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu"><Menu size={20} /></button><button onClick={() => setView('dashboard')} className="hidden sm:block"><Brand compact /></button></div><div className="hidden items-center gap-2 text-xs text-slate-500 md:flex"><LockKeyhole size={13} className="text-forest" /> Last login today at 4:41 PM</div><div className="relative flex items-center gap-3"><button className="icon-button"><Bell size={18} /><span className="notification-dot" /></button><button className="flex items-center gap-2" onClick={() => setMenuOpen(!menuOpen)}><Avatar /><span className="hidden text-sm font-medium text-ink sm:block">Michael</span><ChevronDown size={15} className="text-slate-400" /></button>{menuOpen && <div className="dropdown"><button onClick={() => setView('dashboard')}><HomeIcon size={15} /> Overview</button><button onClick={() => setView('profile')}><UserRound size={15} /> Profile &amp; settings</button><button onClick={onLogout}><LogOut size={15} /> Sign out</button></div>}</div></header>;
}

function SideNav({ view, setView }: { view: View; setView: (view: View) => void }) {
  const links: { label: string; icon: typeof HomeIcon; view: View }[] = [{ label: 'Overview', icon: HomeIcon, view: 'dashboard' }, { label: 'Transactions', icon: Receipt, view: 'transactions' }, { label: 'Transfer money', icon: Send, view: 'transfer' }];
  return <aside className="hidden w-60 shrink-0 flex-col border-r border-stone-200 bg-white px-5 py-7 lg:flex"><Brand compact /><p className="mt-14 mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Your banking</p><nav className="space-y-1">{links.map(({ label, icon: Icon, view: linkView }) => <button key={label} onClick={() => setView(linkView)} className={`nav-link ${view === linkView ? 'active' : ''}`}><Icon size={18} />{label}</button>)}</nav><p className="mb-4 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Support</p><button className="nav-link"><MessageSquare size={18} />Messages<span className="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-forest">2</span></button><button className="nav-link"><Settings size={18} />Settings</button><div className="mt-auto rounded-2xl bg-forest p-4 text-white"><Sparkles size={18} className="text-gold" /><p className="mt-3 text-sm font-medium">Need a hand?</p><p className="mt-1 text-xs leading-5 text-white/65">Your banker is available to help.</p><button className="mt-4 text-xs font-semibold text-gold">Start a message →</button></div></aside>;
}

function AccountCard({ account, active, onSelect }: { account: Account; active: boolean; onSelect: () => void }) {
  return <button onClick={onSelect} className={`account-card ${active ? 'active' : ''}`}><div className="flex items-start justify-between"><div><p className="text-sm text-white/75">{account.name}</p><p className="mt-1 text-xs text-white/55">{account.number}</p></div><CreditCard size={20} className="text-gold" /></div><div className="mt-10"><p className="text-[11px] uppercase tracking-[0.17em] text-white/50">Available balance</p><p className="mt-1 text-3xl font-medium tracking-tight">{money.format(Math.abs(account.available))}</p></div><div className="mt-4 flex items-center justify-between text-xs text-white/60"><span>{account.type}</span><ArrowUpRight size={15} /></div></button>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Send; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="quick-action"><span><Icon size={21} /></span><small>{label}</small></button>;
}

function TransactionRow({ transaction, compact = false }: { transaction: Transaction; compact?: boolean }) {
  const positive = transaction.amount > 0;
  return <div className={`transaction-row ${compact ? 'compact' : ''}`}><div className="transaction-icon"><Receipt size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{transaction.merchant}</p><p className="mt-1 truncate text-xs text-slate-500">{transaction.detail}</p>{transaction.note && <p className="mt-2 flex items-center gap-1 text-xs text-forest"><FileText size={13} />{transaction.note}</p>}</div><div className="text-right"><p className={`text-sm font-medium ${positive ? 'text-forest' : 'text-ink'}`}>{positive ? '+' : ''}{money.format(transaction.amount)}</p>{transaction.status && <span className={`status-pill ${transaction.status.toLowerCase()}`}>{transaction.status}</span>}</div></div>;
}

function Dashboard({ setView, transactions, accounts, loading }: { setView: (view: View) => void; transactions: Transaction[]; accounts: Account[]; loading: boolean }) {
  const [activeAccount, setActiveAccount] = useState(0);
  const account = accounts.length ? (accounts[Math.min(activeAccount, accounts.length - 1)] ?? accounts[0]) : null;
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Tuesday, November 26</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Good afternoon, Michael.</h1><p className="mt-2 text-sm text-slate-500">Here’s your financial snapshot.</p></div><button className="outline-button hidden sm:flex"><HelpCircle size={16} /> Help center</button></div><div className="mt-9 grid gap-5 xl:grid-cols-[1.6fr_1fr]"><section><div className="mb-3 flex items-center justify-between"><h2 className="section-title">Accounts</h2><button className="text-sm font-medium text-forest" onClick={() => setView('dashboard')}>View all</button></div><div className="account-scroll">{loading ? <p className="px-2 py-6 text-sm text-slate-500">Loading your accounts…</p> : accounts.length === 0 ? <p className="px-2 py-6 text-sm text-slate-500">No accounts yet. Your banker will set one up for you.</p> : accounts.map((item, index) => <AccountCard key={item.number} account={item} active={activeAccount === index} onSelect={() => setActiveAccount(index)} />)}</div><div className="mt-6 grid grid-cols-4 gap-3"><QuickAction icon={ArrowRight} label="Transfer" onClick={() => setView('transfer')} /><QuickAction icon={ArrowDownToLine} label="Deposit" onClick={() => setView('transfer')} /><QuickAction icon={WalletCards} label="Pay" onClick={() => setView('transfer')} /><QuickAction icon={MessageSquare} label="Message" onClick={() => undefined} /></div></section><aside className="rounded-3xl bg-[#e7ece5] p-6"><div className="flex items-start justify-between"><div><p className="eyebrow">Your progress</p><h3 className="font-display mt-2 text-2xl text-forest">A balanced month.</h3></div><div className="rounded-full bg-white p-3 text-forest"><ShieldCheck size={19} /></div></div><div className="mt-8 space-y-5"><div><div className="mb-2 flex justify-between text-xs text-slate-600"><span>Monthly spending</span><span>$2,148 of $4,000</span></div><div className="h-2 rounded-full bg-white"><div className="h-2 w-[54%] rounded-full bg-forest" /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/70 p-4"><p className="text-xs text-slate-500">Saved this month</p><p className="mt-2 text-lg font-semibold text-forest">$840.00</p></div><div className="rounded-2xl bg-white/70 p-4"><p className="text-xs text-slate-500">Cashback earned</p><p className="mt-2 text-lg font-semibold text-forest">$42.18</p></div></div></div></aside></div><section className="mt-10 rounded-3xl bg-white shadow-soft"><div className="flex items-center justify-between border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Recent transactions</h2><p className="mt-1 text-xs text-slate-500">{account ? `${account.name} · ${account.number}` : 'No account selected'}</p></div><button className="icon-button"><MoreHorizontal size={19} /></button></div><div>{loading ? <p className="px-6 py-6 text-sm text-slate-500">Loading activity…</p> : transactions.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">No transactions yet.</p> : transactions.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} compact />)}</div><button className="see-more" onClick={() => setView('transactions')}>See all activity <ArrowRight size={15} /></button></section></div>;
}

function Transactions({ transactions, setView, loading }: { transactions: Transaction[]; setView: (view: View) => void; loading: boolean }) {
  const grouped = useMemo(() => transactions.reduce<Record<string, Transaction[]>>((result, transaction) => { (result[transaction.date] ||= []).push(transaction); return result; }, {}), [transactions]);
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Your activity</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Transactions</h1></div><button className="outline-button" onClick={() => setView('transfer')}><Send size={16} /> Make a transfer</button></div><div className="mt-8 flex flex-wrap gap-2"><button className="filter-pill active">All activity</button><button className="filter-pill">Money in</button><button className="filter-pill">Money out</button><button className="filter-pill">Last 90 days <ChevronDown size={14} /></button><button className="filter-pill ml-auto"><Search size={14} /> Search</button></div>{loading ? <p className="mt-8 text-sm text-slate-500">Loading activity…</p> : transactions.length === 0 ? <p className="mt-8 text-sm text-slate-500">No transactions yet.</p> : <div className="mt-8 space-y-7">{Object.entries(grouped).map(([date, items]) => <div key={date}><h2 className="mb-3 text-sm font-semibold text-slate-600">{date}</h2><div className="overflow-hidden rounded-3xl bg-white shadow-soft">{items.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</div></div>)}</div>}</div>;
}

function Transfer({ accounts, onComplete }: { accounts: Account[]; onComplete: () => void }) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [institution, setInstitution] = useState('');
  const [country, setCountry] = useState('United States');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const fromAccount = accounts[0] ?? null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0 || !recipient || !institution || !email || !phone || !accountNumber || !routingNumber) { setMessage('Complete every transfer field and enter your current access code.'); return; }
    if (accessCode.length !== 6) { setMessage('Enter the 6-digit access code your banker gave you.'); return; }
    if (!supabase) { setMessage('Online banking is temporarily unavailable. Please try again later.'); return; }
    setMessage('');
    setBusy(true);
    try {
      await apiPost('/api/auth/verify-code', { code: accessCode });
      const category = country === 'United States' ? 'Bank transfer' : 'International wire';
      const { error } = await supabase.from('transactions').insert({
        merchant: recipient.toUpperCase(),
        amount: parsed,
        direction: 'debit',
        status: 'pending',
        category,
        transfer_country: country,
        counterparty_email: email,
        counterparty_phone: phone,
        payment_details: { accountNumber, routingNumber },
        institution_name: institution,
        source: 'customer',
        transaction_date: new Date().toISOString(),
      });
      if (error) { setMessage('We could not submit your transfer. Please try again.'); return; }
      setDone(true);
      onComplete();
    } catch (err) {
      setMessage((err as Error).message || 'That access code is invalid, already used, or expired. Ask your banker for a new one.');
    } finally {
      setBusy(false);
    }
  };
  if (done) return <div className="page-shell"><div className="success-panel"><div className="success-icon"><Check size={26} /></div><p className="eyebrow">Transfer submitted</p><h1 className="font-display mt-3 text-4xl text-forest">Your transfer is pending review.</h1><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-600">We’ll notify you when the transfer to <strong>{recipient}</strong> is approved. You can track its status in your transactions.</p><button className="primary-button mx-auto mt-8" onClick={() => { setDone(false); setAmount(''); setRecipient(''); setAccessCode(''); }}>Make another transfer <Plus size={17} /></button></div></div>;
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Move money</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Send a transfer.</h1><p className="mt-2 text-sm text-slate-500">Every outgoing payment stays pending until a banker approves it.</p></div><div className="secure-badge"><ShieldCheck size={15} /> Code required</div></div><form onSubmit={submit} className="mt-8 max-w-3xl rounded-3xl bg-white p-6 shadow-soft md:p-8"><div className="grid gap-6 md:grid-cols-2"><div className="md:col-span-2"><label className="field-label">From account</label><button type="button" className="select-display"><div className="flex items-center gap-3"><div className="mini-account-icon"><Landmark size={16} /></div><div className="text-left"><p className="text-sm font-medium">{fromAccount ? `${fromAccount.name} · ${fromAccount.number}` : 'No account available'}</p><p className="text-xs text-slate-500">{fromAccount ? `Available ${money.format(Math.abs(fromAccount.available))}` : 'Contact your banker'}</p></div></div><ChevronDown size={16} /></button></div><Field label="Recipient name or business *" value={recipient} onChange={setRecipient} placeholder="Who are you sending to?" /><Field label="Receiving bank or provider *" value={institution} onChange={setInstitution} placeholder="Bank, card, or provider name" /><div><label className="field-label">Destination country *</label><select className="field-input" value={country} onChange={(event) => setCountry(event.target.value)}>{['United States', ...wireDestinations].map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="field-label">Amount *</label><div className="relative"><span className="absolute left-4 top-3.5 text-slate-400">$</span><input className="field-input pl-8" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" /></div></div><Field label="Recipient email *" value={email} onChange={setEmail} placeholder="recipient@example.com" type="email" /><Field label="Recipient phone *" value={phone} onChange={setPhone} placeholder="(000) 000-0000" type="tel" /><Field label="Account or card number *" value={accountNumber} onChange={setAccountNumber} placeholder="Required for all transfers" /><Field label={country === 'United States' ? 'Routing number *' : 'International payment reference *'} value={routingNumber} onChange={setRoutingNumber} placeholder="Enter payment information" /><div className="md:col-span-2 rounded-2xl bg-[#edf4ed] p-4"><label className="field-label">Current access code *</label><p className="mb-3 text-xs leading-5 text-slate-600">A fresh code is required whenever you send money. Your banker can issue one from the staff workspace.</p><input className="field-input max-w-xs bg-white text-center tracking-[.35em]" value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="••••••" /></div></div>{message && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}<div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-6"><p className="max-w-xs text-xs leading-5 text-slate-500">The receiving bank and contact details will appear in your transfer record.</p><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : <>Review transfer <ArrowRight size={17} /></>}</button></div></form></div>;
}

function Profile({ setView }: { setView: (view: View) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Your profile</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Profile &amp; settings</h1><p className="mt-2 text-sm text-slate-500">Keep your contact details and profile picture up to date.</p></div><button className="outline-button" onClick={() => setView('dashboard')}><ArrowLeft size={16} /> Back to overview</button></div><div className="mt-8 grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-3xl bg-forest p-8 text-white"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#d8e4d8] text-2xl font-bold text-forest">{preview ? <img src={preview} alt="Profile preview" className="h-full w-full object-cover" /> : 'MC'}</div><h2 className="font-display mt-6 text-3xl">Michael Carter</h2><p className="mt-2 text-sm text-white/65">Member since 2022 · Checking x1234</p><label className="gold-button mt-7 cursor-pointer"><Plus size={16} /> Upload picture<input className="hidden" type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} /></label></section><section className="rounded-3xl bg-white p-6 shadow-soft md:p-8"><p className="eyebrow">Personal information</p><h2 className="font-display mt-2 text-3xl text-forest">Your details.</h2><div className="mt-8 grid gap-5 md:grid-cols-2"><Field label="Full name" value="Michael Carter" onChange={() => undefined} /><Field label="Email address" value="michael@firstbanktrust.com" onChange={() => undefined} /><Field label="Phone number" value="(276) 555-0198" onChange={() => undefined} /><Field label="Mailing address" value="120 Main Street, Abingdon VA" onChange={() => undefined} /></div><button className="primary-button mt-7">Save changes <Check size={16} /></button></section></div></div>;
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
  const fundsManaged = allAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);

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
      await apiPost('/api/admin/create-customer', { name, username: cleanUser, password, email: email || undefined, phone: phone || undefined });
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

  const createAccount = async () => {
    if (!selected) { setActionNotice('Select a customer first.'); return; }
    setActionNotice('');
    try {
      await apiPost('/api/admin/set-balance', { userId: selected.id, balance: 0 });
      await loadCustomers();
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not create the account.');
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
    const entries = historicTransactions.map((transaction) => ({
      merchant: transaction.merchant,
      amount: Math.abs(transaction.amount),
      direction: transaction.amount < 0 ? 'out' : 'in',
      note: transaction.note,
      category: transaction.category,
      date: transaction.date,
    }));
    try {
      // Toggle: hides the pre-built history if it is showing, shows (or first-time fills) it otherwise.
      const visible = !seededVisible;
      await apiPost('/api/admin/toggle-history', { userId: selected.id, visible, entries: visible ? entries : undefined });
      await loadUserTxns(selected.id);
      setActionNotice(visible ? `Pre-built history is now visible to ${selected.display_name}.` : `Pre-built history is now hidden from ${selected.display_name}.`);
    } catch (err) {
      setActionNotice((err as Error).message || 'Could not auto-fill history.');
    }
  };

  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">Staff workspace</p><h1 className="font-display mt-2 text-4xl tracking-[-0.04em] text-forest">Welcome back.</h1><p className="mt-2 text-sm text-slate-500">Manage customers, accounts, history, and transfer reviews.</p></div><button className="outline-button" onClick={() => setView('landing')}><X size={16} /> Exit staff view</button></div><div className="admin-metrics mt-8"><div className="metric-card"><UsersRound size={19} /><span>Customers</span><strong>{customers.length}</strong><small>Active profiles</small></div><div className="metric-card"><Send size={19} /><span>Pending transfers</span><strong>{String(pendingQueue.length).padStart(2, '0')}</strong><small className="text-gold">{pendingQueue.length ? 'Needs review' : 'All clear'}</small></div><div className="metric-card"><WalletCards size={19} /><span>Funds managed</span><strong>{money.format(fundsManaged)}</strong><small>Across {allAccounts.length} visible accounts</small></div></div>{loadError && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}<div className="admin-grid mt-8"><section className="rounded-3xl bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Customer management</h2><p className="mt-1 text-xs text-slate-500">Issue usernames, passwords, and fresh access codes.</p></div><button className="primary-button" onClick={() => setShowCreate(!showCreate)}><Plus size={16} /> Add customer</button></div>{showCreate && <div className="border-b border-stone-100 bg-cream/60 p-6"><div className="grid gap-3 md:grid-cols-2"><input className="field-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer name" /><input className="field-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" /><input className="field-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" type="tel" /><input className="field-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Banking username" /><input className="field-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password" type="password" /><button className="primary-button md:w-fit" onClick={createCustomer}>Create profile</button></div>{createNotice && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{createNotice}</p>}<p className="mt-3 text-xs text-slate-500">After creating the profile, send a fresh access code before the first login.</p></div>}<div className="divide-y divide-stone-100">{loading ? <p className="px-6 py-6 text-sm text-slate-500">Loading customers…</p> : customers.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">No customers yet. Add one to get started.</p> : customers.map((customer) => { const accountSummary = customer.accounts.length ? customer.accounts.map((account) => `${account.name} · ${account.masked_number}`).join(', ') : 'Not assigned'; const revealed = codes[customer.id]; return <div key={customer.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"><div className="flex items-center gap-3"><Avatar name={customer.display_name || customer.username} /><div><p className="text-sm font-medium">{customer.display_name || customer.username}</p><p className="mt-1 text-xs text-slate-500">{customer.email} · @{customer.username} · {accountSummary}</p>{revealed && <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#edf4ed] px-3 py-1 text-xs font-bold tracking-[.3em] text-forest"><LockKeyhole size={12} /> {revealed}</p>}{!revealed && customer.hasActiveCode && <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#edf4ed] px-3 py-1 text-xs font-semibold text-forest"><LockKeyhole size={12} /> Active code issued</p>}</div></div><div className="flex items-center gap-4"><button className="text-xs font-bold text-forest" onClick={() => generateCodeFor(customer.id)}>{customer.hasActiveCode ? 'New code' : 'Generate code'}</button><span className={`status-pill ${(customer.status || 'active').toLowerCase()}`}>{customer.status || 'Active'}</span></div></div>; })}</div></section><section className="rounded-3xl bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Accounts &amp; balances</h2><p className="mt-1 text-xs text-slate-500">Add accounts and set balances shown to the member.</p></div><button className="outline-button" onClick={createAccount}><Plus size={16} /> Add account</button></div><div className="border-b border-stone-100 bg-cream/60 p-6"><label className="field-label">Editing customer</label><select className="field-input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{customers.length === 0 && <option value="">No customers</option>}{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name || customer.username} · @{customer.username}</option>)}</select><p className="mt-2 text-xs text-slate-500">Balances and history entries below apply to this customer.</p></div><div className="divide-y divide-stone-100">{!selected ? <p className="px-6 py-6 text-sm text-slate-500">Select a customer to manage their accounts.</p> : selected.accounts.length === 0 ? <p className="px-6 py-6 text-sm text-slate-500">No accounts yet. Use “Add account” to create one.</p> : selected.accounts.map((account) => <div key={account.id} className="px-6 py-4"><div className="flex items-center justify-between"><div><span className="text-sm font-medium text-ink">{account.name}</span><span className="ml-2 text-xs text-slate-500">{account.masked_number} · {account.type}</span></div><span className="text-sm font-semibold text-forest">{money.format(Number(account.balance || 0))}</span></div><div className="mt-3 flex items-center gap-2"><div className="relative flex-1"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input className="field-input pl-7" value={balanceDrafts[account.id] ?? ''} onChange={(event) => setBalanceDrafts((current) => ({ ...current, [account.id]: event.target.value.replace(/[^0-9.-]/g, '') }))} inputMode="decimal" placeholder="Set new balance" /></div><button className="outline-button" onClick={() => applyBalance(account.id)}><Check size={15} /> Set</button></div></div>)}</div><div className="border-t border-stone-100 p-6"><div className="flex items-center justify-between gap-3"><p className="field-label mb-0">Transaction history</p><button className="gold-button" onClick={seedHistory}><FileText size={15} /> {seededVisible ? 'Hide pre-built history' : seededRows.length ? 'Show pre-built history' : 'Auto-fill history'}</button></div><p className="mt-2 mb-4 text-xs text-slate-500">Toggle the pre-built multi-year history on or off for this customer, and add as many individual entries as you want.</p><div className="grid gap-3 sm:grid-cols-[1fr_140px_120px]"><input className="field-input" value={historyMerchant} onChange={(event) => setHistoryMerchant(event.target.value)} placeholder="Bank or provider" /><input className="field-input" value={historyAmount} onChange={(event) => setHistoryAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="Amount" inputMode="decimal" /><select className="field-input" value={historyDirection} onChange={(event) => setHistoryDirection(event.target.value as 'in' | 'out')}><option value="out">Money out</option><option value="in">Money in</option></select></div><div className="mt-3 flex items-center gap-2"><label className="field-label mb-0">Status</label><select className="field-input max-w-[160px]" value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value as 'complete' | 'pending')}><option value="complete">Completed</option><option value="pending">Pending</option></select></div><textarea className="field-input mt-3 min-h-20" value={historyNote} onChange={(event) => setHistoryNote(event.target.value)} placeholder="Add a detailed note to this payment or historical wire" /><button className="outline-button mt-3" onClick={saveHistoryEntry}><Plus size={15} /> Save history entry</button>{actionNotice && <p className="mt-3 rounded-xl bg-[#edf4ed] px-4 py-2 text-xs text-forest">{actionNotice}</p>}{selected && <div className="mt-6"><p className="field-label">Entries for {selected.display_name} ({staffRows.length}{seededRows.length ? ` + ${seededRows.length} pre-built ${seededVisible ? 'shown' : 'hidden'}` : ''})</p>{staffRows.length === 0 ? <p className="text-xs text-slate-500">No individual entries yet.</p> : <div className="max-h-96 space-y-3 overflow-y-auto">{staffRows.map((txn) => { const draft = draftFor(txn); return <div key={txn.id} className="rounded-xl border border-stone-100 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{txn.merchant}</p><p className="text-xs text-slate-500">{money.format(Number(txn.amount))} · {txn.source === 'customer' ? 'Customer transfer' : 'Staff entry'}</p></div><button className="text-xs font-bold text-red-700" onClick={() => removeTxn(txn)}>Remove</button></div><div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr_auto]"><select className="field-input" value={draft.status} onChange={(event) => setDraft(txn, { status: event.target.value })}><option value="pending">Pending</option><option value="complete">Completed</option><option value="cancelled">Cancelled</option></select><input className="field-input" value={draft.note} onChange={(event) => setDraft(txn, { note: event.target.value })} placeholder="Note shown to customer" /><button className="outline-button" onClick={() => saveTxn(txn)}><Check size={14} /> Save</button></div></div>; })}</div>}</div>}</div></section></div><section className="mt-8 rounded-3xl bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-5"><div><h2 className="section-title">Transfer review queue</h2><p className="mt-1 text-xs text-slate-500">Customer transfers stay pending until you approve, complete, or cancel them.</p></div><span className="status-pill pending">{pendingQueue.length} pending</span></div><div className="grid gap-6 p-6 lg:grid-cols-2">{pendingQueue.length === 0 ? <p className="text-sm text-slate-500 lg:col-span-2">No transfers are waiting for review.</p> : pendingQueue.map((txn) => { const draft = draftFor(txn); return <div key={txn.id} className="rounded-2xl bg-cream p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">{txn.merchant}</p><p className="mt-1 text-xs text-slate-500">{txn.customer_name} · {txn.institution_name ?? 'Bank'}{txn.transfer_country ? ` · ${txn.transfer_country}` : ''}</p></div><p className="text-lg font-medium text-ink">{money.format(Math.abs(Number(txn.amount)))}</p></div><textarea className="field-input mt-5 min-h-24 bg-white" value={draft.note} onChange={(event) => setDraft(txn, { note: event.target.value })} placeholder="Add a detailed approval, completion, or cancellation note" /><div className="mt-4 flex flex-wrap items-center gap-2"><select className="field-input max-w-[160px]" value={draft.status} onChange={(event) => setDraft(txn, { status: event.target.value })}><option value="pending">Pending</option><option value="complete">Completed</option><option value="cancelled">Cancelled</option></select><button className="primary-button" onClick={() => saveTxn(txn)}>Save review</button></div></div>; })}</div></section></div>;
}

export default function Home() {
  const [view, setView] = useState<View>('landing');
  const [contactInterest, setContactInterest] = useState('Checking account');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const loadCustomerData = useCallback(async () => {
    if (!supabase) { setDataLoading(false); return; }
    setDataLoading(true);
    const [{ data: accountRows }, { data: txnRows }] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at'),
      supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
    ]);
    const mappedAccounts: Account[] = (accountRows ?? []).map((row: any) => ({
      name: row.name,
      number: row.masked_number,
      type: row.type,
      balance: Number(row.balance ?? 0),
      available: Number(row.available_balance ?? row.balance ?? 0),
    }));
    const mappedTransactions: Transaction[] = (txnRows ?? []).map((row: any) => ({
      id: String(row.id),
      merchant: row.merchant,
      detail: `${row.category ?? 'Activity'} · ${formatTxnDate(row.transaction_date)}`,
      amount: Number(row.amount ?? 0),
      date: formatTxnDate(row.transaction_date),
      category: row.category ?? 'Activity',
      status: dbStatusToLabel(row.status),
      note: row.note ?? undefined,
    }));
    setAccounts(mappedAccounts);
    setTransactions(mappedTransactions);
    setDataLoading(false);
  }, []);

  // On mount, resume an existing session and route to the right workspace.
  useEffect(() => {
    let active = true;
    const resume = async () => {
      if (!supabase) { if (active) setSessionChecked(true); return; }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const session = data.session;
      if (!session) { setSessionChecked(true); return; }
      const { data: profile } = await supabase.from('profiles').select('role, last_access_code_at').eq('id', session.user.id).single();
      if (!active) return;
      if (profile?.role === 'admin') {
        setView('admin');
      } else {
        // Customers only resume if a banker-issued code was accepted in the last 24 hours.
        const lastCode = profile?.last_access_code_at ? new Date(profile.last_access_code_at).getTime() : 0;
        if (Date.now() - lastCode < 24 * 60 * 60 * 1000) {
          setView('dashboard');
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

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setAccounts([]);
    setTransactions([]);
    setView('landing');
  };

  const enterDashboard = () => { setView('dashboard'); loadCustomerData(); };
  const openContact = (interest: string) => { setContactInterest(interest); setView('contact'); };

  if (view === 'landing') return <Landing onLogin={() => setView('login')} onContact={openContact} />;
  if (view === 'login') return <Login onLogin={enterDashboard} onAdmin={() => setView('admin')} onBack={() => setView('landing')} />;
  if (view === 'contact') return <ContactForm interest={contactInterest} onBack={() => setView('landing')} />;
  if (view === 'admin') return <div className="app-frame"><TopBar view={view} setView={setView} onLogout={logout} /><Admin setView={setView} /></div>;
  if (view === 'profile') return <div className="app-frame"><TopBar view={view} setView={setView} onLogout={logout} /><Profile setView={setView} /></div>;
  return <div className="app-frame"><TopBar view={view} setView={setView} onLogout={logout} /><div className="flex min-h-[calc(100vh-73px)]"><SideNav view={view} setView={setView} /><main className="min-w-0 flex-1">{view === 'dashboard' && <Dashboard setView={setView} transactions={transactions} accounts={accounts} loading={dataLoading} />}{view === 'transactions' && <Transactions transactions={transactions} setView={setView} loading={dataLoading} />}{view === 'transfer' && <Transfer accounts={accounts} onComplete={loadCustomerData} />}</main></div><nav className="bottom-nav lg:hidden"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><HomeIcon size={18} /><span>Home</span></button><button className={view === 'transactions' ? 'active' : ''} onClick={() => setView('transactions')}><Receipt size={18} /><span>Activity</span></button><button className={view === 'transfer' ? 'active' : ''} onClick={() => setView('transfer')}><Send size={18} /><span>Transfer</span></button><button onClick={() => setView('profile')}><UserRound size={18} /><span>Profile</span></button></nav></div>;
}
