// Shared account rules (used by the website and the server).

export type AccountType = 'checking' | 'savings' | 'money_market' | 'credit_card' | 'ira' | 'loan' | 'mortgage';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'money_market', label: 'Money market' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'ira', label: 'IRA (retirement)' },
  { value: 'loan', label: 'Loan' },
  { value: 'mortgage', label: 'Mortgage' },
];

export const ACCOUNT_TYPE_LABELS: Record<string, string> = Object.fromEntries(ACCOUNT_TYPES.map((item) => [item.value, item.label]));

export const LOAN_TYPES = ['Personal loan', 'Auto loan', 'Student loan', 'Home equity loan', 'Business loan'];
export const CARD_NETWORKS = ['Visa', 'Mastercard', 'American Express'] as const;
export type CardNetwork = (typeof CARD_NETWORKS)[number];

/** Money the customer can spend or send from. */
export const isSpendable = (type: string) => type === 'checking' || type === 'savings' || type === 'money_market';
/** Accounts where the balance is money owed. */
export const isDebt = (type: string) => type === 'credit_card' || type === 'loan' || type === 'mortgage';
/** Accounts a customer can report a deposit into. */
export const canDepositTo = (type: string) => isSpendable(type) || type === 'ira';

/* ---------- randomness ---------- */

const randomInt = (maxExclusive: number): number => {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % maxExclusive;
};
const randomDigits = (length: number): string => Array.from({ length }, () => String(randomInt(10))).join('');

/* ---------- card numbers ---------- */

const luhnSum = (digits: string): number => {
  let sum = 0;
  let double = true; // the check digit will be appended, so start doubling from the rightmost existing digit
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i]);
    if (double) { value *= 2; if (value > 9) value -= 9; }
    sum += value;
    double = !double;
  }
  return sum;
};

const withCheckDigit = (partial: string): string => partial + String((10 - (luhnSum(partial) % 10)) % 10);

/** Random, well-formed card number (passes the Luhn check). Not a real, issued card. */
export function generateCardNumber(network: CardNetwork): string {
  if (network === 'American Express') return withCheckDigit(`3${['4', '7'][randomInt(2)]}${randomDigits(12)}`); // 15 digits
  if (network === 'Mastercard') return withCheckDigit(`5${String(1 + randomInt(5))}${randomDigits(13)}`);        // 16 digits
  return withCheckDigit(`4${randomDigits(14)}`);                                                                    // Visa, 16 digits
}

export function formatCardNumber(number: string): string {
  const clean = number.replace(/\D/g, '');
  return clean.length === 15 ? `${clean.slice(0, 4)} ${clean.slice(4, 10)} ${clean.slice(10)}` : clean.replace(/(.{4})/g, '$1 ').trim();
}

export function isValidLuhn(number: string): boolean {
  const clean = number.replace(/\D/g, '');
  if (clean.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    let value = Number(clean[i]);
    if (double) { value *= 2; if (value > 9) value -= 9; }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

/** MM/YY three to five years from today. */
export function generateExpiry(now = new Date()): string {
  const year = now.getFullYear() + 3 + randomInt(3);
  return `${String(1 + randomInt(12)).padStart(2, '0')}/${String(year).slice(-2)}`;
}

/* ---------- loans ---------- */

/** Standard amortised monthly payment. */
export function monthlyPayment(principal: number, annualRatePercent: number, termMonths: number): number {
  if (!(principal > 0) || !(termMonths > 0)) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  const payment = monthlyRate === 0 ? principal / termMonths : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  return Math.round(payment * 100) / 100;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** The next occurrence of a day-of-month (1-28), always in the future. */
export function nextDueDate(dayOfMonth: number, now = new Date()): string {
  const day = Math.min(28, Math.max(1, Math.round(dayOfMonth) || 1));
  const candidate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), day));
  if (candidate.getTime() <= now.getTime()) candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  return isoDate(candidate);
}

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDate(d);
}

export const newLoanNumber = (): string => randomDigits(10);
export const newMaskedNumber = (): string => `x${randomDigits(4)}`;

/* ---------- building and validating account details ---------- */

export type AccountInput = {
  type: AccountType;
  name?: string;
  /** Deposit accounts: the balance. Credit cards, loans, mortgages: the amount currently owed. */
  amount: number;
  creditLimit?: number;
  apr?: number;
  network?: CardNetwork;
  apy?: number;
  minimumBalance?: number;
  iraType?: 'Traditional' | 'Roth';
  contributionsThisYear?: number;
  contributionLimit?: number;
  loanType?: string;
  originalAmount?: number;
  interestRate?: number;
  termMonths?: number;
  originationDate?: string;
  dueDay?: number;
  propertyAddress?: string;
  rateType?: 'Fixed' | 'Adjustable';
  monthlyEscrow?: number;
};

export type BuiltAccount = {
  name: string;
  type: AccountType;
  maskedNumber: string;
  balance: number;
  available: number;
  details: Record<string, unknown>;
};

const finite = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Turns what the banker typed into a complete account (generated numbers, payments, dates). Throws a readable Error. */
export function buildAccount(input: AccountInput, now = new Date()): BuiltAccount {
  const amount = finite(input.amount, NaN);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter an amount of zero or more.');
  const label = ACCOUNT_TYPE_LABELS[input.type];
  if (!label) throw new Error('Choose an account type.');

  switch (input.type) {
    case 'checking':
    case 'savings':
    case 'money_market': {
      const details: Record<string, unknown> = {};
      if (input.type === 'savings') details.apy = finite(input.apy, 3.5);
      if (input.type === 'money_market') { details.apy = finite(input.apy, 4.25); details.minimumBalance = finite(input.minimumBalance, 1000); }
      return { name: input.name?.trim() || label, type: input.type, maskedNumber: newMaskedNumber(), balance: round2(amount), available: round2(amount), details };
    }
    case 'ira': {
      const iraType = input.iraType === 'Roth' ? 'Roth' : 'Traditional';
      return {
        name: input.name?.trim() || `${iraType} IRA`, type: 'ira', maskedNumber: newMaskedNumber(), balance: round2(amount), available: round2(amount),
        details: { iraType, contributionsThisYear: finite(input.contributionsThisYear, 0), contributionLimit: finite(input.contributionLimit, 7000) },
      };
    }
    case 'credit_card': {
      const limit = finite(input.creditLimit, NaN);
      if (!(limit > 0)) throw new Error('Enter the credit limit.');
      if (amount > limit) throw new Error('The amount owed cannot be more than the credit limit.');
      const network = CARD_NETWORKS.includes(input.network as CardNetwork) ? (input.network as CardNetwork) : 'Visa';
      const cardNumber = generateCardNumber(network);
      const apr = finite(input.apr, 19.99);
      const minimumPayment = amount === 0 ? 0 : round2(Math.max(amount * 0.02, Math.min(amount, 25)));
      return {
        name: input.name?.trim() || `${network} card`, type: 'credit_card', maskedNumber: `x${cardNumber.slice(-4)}`,
        balance: -round2(amount), available: round2(limit - amount),
        details: { network, cardNumber, expiry: generateExpiry(now), creditLimit: round2(limit), apr, minimumPayment, paymentDueDate: nextDueDate(finite(input.dueDay, 15), now) },
      };
    }
    case 'loan': {
      const original = finite(input.originalAmount, amount);
      if (!(original > 0)) throw new Error('Enter the original loan amount.');
      if (amount > original) throw new Error('The amount still owed cannot be more than the original loan amount.');
      const rate = finite(input.interestRate, 7.5);
      const term = Math.round(finite(input.termMonths, 60));
      if (term < 1 || term > 600) throw new Error('Enter a loan term between 1 and 600 months.');
      const origination = input.originationDate || new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10);
      const loanType = LOAN_TYPES.includes(input.loanType ?? '') ? (input.loanType as string) : 'Personal loan';
      const loanNumber = newLoanNumber();
      return {
        name: input.name?.trim() || loanType, type: 'loan', maskedNumber: `x${loanNumber.slice(-4)}`,
        balance: -round2(amount), available: 0,
        details: {
          loanType, loanNumber, originalAmount: round2(original), interestRate: rate, termMonths: term,
          monthlyPayment: monthlyPayment(original, rate, term), nextPaymentDate: nextDueDate(finite(input.dueDay, 1), now),
          originationDate: origination, maturityDate: addMonths(origination, term),
        },
      };
    }
    case 'mortgage': {
      const original = finite(input.originalAmount, amount);
      if (!(original > 0)) throw new Error('Enter the original mortgage amount.');
      if (amount > original) throw new Error('The amount still owed cannot be more than the original mortgage amount.');
      const rate = finite(input.interestRate, 6.5);
      const term = Math.round(finite(input.termMonths, 360));
      if (term < 12 || term > 600) throw new Error('Enter a mortgage term between 12 and 600 months.');
      const origination = input.originationDate || new Date(now.getFullYear() - 2, now.getMonth(), 1).toISOString().slice(0, 10);
      const escrow = Math.max(0, finite(input.monthlyEscrow, 0));
      const principalAndInterest = monthlyPayment(original, rate, term);
      const loanNumber = newLoanNumber();
      return {
        name: input.name?.trim() || 'Home mortgage', type: 'mortgage', maskedNumber: `x${loanNumber.slice(-4)}`,
        balance: -round2(amount), available: 0,
        details: {
          loanNumber, propertyAddress: (input.propertyAddress ?? '').trim() || 'Property address on file', originalAmount: round2(original),
          interestRate: rate, rateType: input.rateType === 'Adjustable' ? 'Adjustable' : 'Fixed', termMonths: term,
          monthlyPrincipalInterest: principalAndInterest, monthlyEscrow: round2(escrow), monthlyPayment: round2(principalAndInterest + escrow),
          nextPaymentDate: nextDueDate(finite(input.dueDay, 1), now), originationDate: origination, maturityDate: addMonths(origination, term),
        },
      };
    }
    default:
      throw new Error('Choose an account type.');
  }
}
