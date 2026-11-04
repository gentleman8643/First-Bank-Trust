// Single source of truth for per-country banking rules.
// Used by the website (forms) and by the server (so both agree on currency and required details).

export type PayField = {
  key: string;
  label: string;
  placeholder: string;
  help?: string;
  /** Regex source the value must match after spaces, dots and dashes are removed. */
  pattern?: string;
  /** 'iban' fields are also checked with the IBAN mod-97 checksum. */
  kind?: 'iban';
  maxLength?: number;
};

export type DepositMethod = { title: string; detail: string };

export type Country = {
  name: string;
  currency: string;
  /** Short name of the local payment rail, shown in the transfer form. */
  rail: string;
  fields: PayField[];
  depositMethods: DepositMethod[];
};

const BIC: PayField = {
  key: 'bic',
  label: 'SWIFT / BIC code',
  placeholder: 'e.g. DEUTDEFF',
  help: '8 or 11 letters and numbers.',
  pattern: '^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$',
  maxLength: 11,
};

export const COUNTRIES: Country[] = [
  {
    name: 'United States',
    currency: 'USD',
    rail: 'ACH / Wire',
    fields: [
      { key: 'routingNumber', label: 'Routing number (ABA)', placeholder: '9 digits', pattern: '^\\d{9}$', maxLength: 9, help: 'The 9-digit number on the bottom of a check.' },
      { key: 'accountNumber', label: 'Account number', placeholder: 'Recipient account number', pattern: '^\\d{4,17}$', maxLength: 17 },
    ],
    depositMethods: [
      { title: 'Direct deposit (ACH)', detail: 'Give your employer or sender your account number and our routing number. Funds usually arrive in 1 to 3 business days.' },
      { title: 'Domestic wire transfer', detail: 'Same-day transfer from another US bank. Ask your banker for the full wire instructions.' },
      { title: 'Mobile check deposit', detail: 'Photograph the front and back of a signed check in the app. Funds are reviewed by your banker.' },
      { title: 'Cash or check at a branch', detail: 'Visit any First Bank & Trust branch with your ID and account number.' },
    ],
  },
  {
    name: 'Canada',
    currency: 'CAD',
    rail: 'EFT / Interac / Wire',
    fields: [
      { key: 'institutionNumber', label: 'Institution number', placeholder: '3 digits', pattern: '^\\d{3}$', maxLength: 3 },
      { key: 'transitNumber', label: 'Transit (branch) number', placeholder: '5 digits', pattern: '^\\d{5}$', maxLength: 5 },
      { key: 'accountNumber', label: 'Account number', placeholder: '7 to 12 digits', pattern: '^\\d{7,12}$', maxLength: 12 },
    ],
    depositMethods: [
      { title: 'Interac e-Transfer', detail: 'Send an e-Transfer to the deposit email your banker gives you. Usually arrives within minutes.' },
      { title: 'Electronic funds transfer (EFT)', detail: 'Direct deposit using your institution, transit and account numbers.' },
      { title: 'Wire transfer (Lynx)', detail: 'For large same-day payments. Ask your banker for wire instructions.' },
      { title: 'Cash or cheque at a branch', detail: 'Visit a branch with your ID and account number.' },
    ],
  },
  {
    name: 'United Kingdom',
    currency: 'GBP',
    rail: 'Faster Payments / CHAPS',
    fields: [
      { key: 'sortCode', label: 'Sort code', placeholder: '6 digits, e.g. 20-45-45', pattern: '^\\d{6}$', maxLength: 8 },
      { key: 'accountNumber', label: 'Account number', placeholder: '8 digits', pattern: '^\\d{8}$', maxLength: 8 },
    ],
    depositMethods: [
      { title: 'Faster Payments', detail: 'Send from any UK bank using your sort code and account number. Usually arrives within minutes.' },
      { title: 'Bank transfer (BACS)', detail: 'Used for salary and direct debits. Arrives in about 3 working days.' },
      { title: 'CHAPS', detail: 'Same-day, high-value payments. Ask your banker for CHAPS details.' },
      { title: 'Cash or cheque at a branch', detail: 'Visit a branch with photo ID and your account number.' },
    ],
  },
  {
    name: 'Mexico',
    currency: 'MXN',
    rail: 'SPEI',
    fields: [
      { key: 'clabe', label: 'CLABE interbancaria', placeholder: '18 digits', pattern: '^\\d{18}$', maxLength: 18, help: 'The 18-digit standardized account number.' },
    ],
    depositMethods: [
      { title: 'SPEI transfer', detail: 'Send from any Mexican bank using your CLABE. Arrives within seconds.' },
      { title: 'Cash deposit at a partner store', detail: 'Ask your banker for a deposit reference to pay at partner stores.' },
      { title: 'International wire (SWIFT)', detail: 'For funds sent from abroad. Ask your banker for wire instructions.' },
    ],
  },
  {
    name: 'Germany',
    currency: 'EUR',
    rail: 'SEPA',
    fields: [
      { key: 'iban', label: 'IBAN', placeholder: 'DE00 0000 0000 0000 0000 00', kind: 'iban', pattern: '^DE\\d{20}$', maxLength: 27, help: 'German IBANs have 22 characters and start with DE.' },
      BIC,
    ],
    depositMethods: [
      { title: 'SEPA credit transfer', detail: 'Send from any euro-zone bank using your IBAN. Arrives by the next business day.' },
      { title: 'SEPA Instant', detail: 'Arrives within seconds when the sending bank supports it.' },
      { title: 'Direct debit (SEPA Lastschrift)', detail: 'Authorise a debit from your other euro account. Ask your banker to set it up.' },
    ],
  },
  {
    name: 'France',
    currency: 'EUR',
    rail: 'SEPA',
    fields: [
      { key: 'iban', label: 'IBAN', placeholder: 'FR00 0000 0000 0000 0000 0000 000', kind: 'iban', pattern: '^FR\\d{2}[A-Za-z0-9]{23}$', maxLength: 34, help: 'French IBANs have 27 characters and start with FR.' },
      BIC,
    ],
    depositMethods: [
      { title: 'Virement SEPA', detail: 'Send from any euro-zone bank using your IBAN. Arrives by the next business day.' },
      { title: 'Virement instantané', detail: 'Arrives within seconds when the sending bank supports it.' },
      { title: 'Prélèvement SEPA', detail: 'Authorise a debit from your other euro account. Ask your banker to set it up.' },
    ],
  },
  {
    name: 'Australia',
    currency: 'AUD',
    rail: 'NPP / BECS',
    fields: [
      { key: 'bsb', label: 'BSB', placeholder: '6 digits, e.g. 062-000', pattern: '^\\d{6}$', maxLength: 7 },
      { key: 'accountNumber', label: 'Account number', placeholder: '6 to 10 digits', pattern: '^\\d{6,10}$', maxLength: 10 },
    ],
    depositMethods: [
      { title: 'PayID / Osko (NPP)', detail: 'Send instantly to your PayID or your BSB and account number.' },
      { title: 'Direct entry (BECS)', detail: 'Standard bank transfer using BSB and account number. Arrives the next business day.' },
      { title: 'International wire (SWIFT)', detail: 'For funds from overseas. Ask your banker for wire instructions.' },
    ],
  },
  {
    name: 'Japan',
    currency: 'JPY',
    rail: 'Zengin',
    fields: [
      { key: 'bankCode', label: 'Bank code (Zengin)', placeholder: '4 digits', pattern: '^\\d{4}$', maxLength: 4 },
      { key: 'branchCode', label: 'Branch code', placeholder: '3 digits', pattern: '^\\d{3}$', maxLength: 3 },
      { key: 'accountNumber', label: 'Account number', placeholder: '7 digits', pattern: '^\\d{7}$', maxLength: 7 },
    ],
    depositMethods: [
      { title: 'Zengin bank transfer (furikomi)', detail: 'Domestic transfer using bank code, branch code and account number. Usually same day.' },
      { title: 'International wire (SWIFT)', detail: 'For funds from overseas. Ask your banker for wire instructions.' },
      { title: 'Cash deposit at a branch or ATM', detail: 'Deposit with your account number and ID.' },
    ],
  },
  {
    name: 'Brazil',
    currency: 'BRL',
    rail: 'PIX / TED',
    fields: [
      { key: 'bankCode', label: 'Bank code (COMPE)', placeholder: '3 digits', pattern: '^\\d{3}$', maxLength: 3 },
      { key: 'branch', label: 'Branch (agência)', placeholder: '4 or 5 digits', pattern: '^\\d{4,5}$', maxLength: 5 },
      { key: 'accountNumber', label: 'Account number (with digit)', placeholder: 'e.g. 12345-6', pattern: '^\\d{5,12}[0-9A-Za-z]$', maxLength: 14 },
      { key: 'taxId', label: 'Recipient CPF or CNPJ', placeholder: '11 or 14 digits', pattern: '^(\\d{11}|\\d{14})$', maxLength: 18, help: 'Brazilian tax ID of the recipient.' },
    ],
    depositMethods: [
      { title: 'PIX', detail: 'Instant transfer using your PIX key. Ask your banker to register your key.' },
      { title: 'TED', detail: 'Same-day bank transfer using bank, branch and account numbers.' },
      { title: 'Boleto', detail: 'Pay a generated slip at any bank or online. Ask your banker for a boleto.' },
    ],
  },
  {
    name: 'Singapore',
    currency: 'SGD',
    rail: 'FAST / PayNow',
    fields: [
      { ...BIC, label: 'Bank SWIFT / BIC code', placeholder: 'e.g. DBSSSGSG' },
      { key: 'accountNumber', label: 'Account number', placeholder: '7 to 14 digits', pattern: '^\\d{7,14}$', maxLength: 14 },
    ],
    depositMethods: [
      { title: 'PayNow', detail: 'Instant transfer using your registered mobile number or ID.' },
      { title: 'FAST transfer', detail: 'Fast and secure transfers from other Singapore banks, usually within minutes.' },
      { title: 'GIRO', detail: 'Scheduled bank transfers. Ask your banker to set up a GIRO arrangement.' },
    ],
  },
  {
    name: 'Switzerland',
    currency: 'CHF',
    rail: 'SIC / SEPA',
    fields: [
      { key: 'iban', label: 'IBAN', placeholder: 'CH00 0000 0000 0000 0000 0', kind: 'iban', pattern: '^CH\\d{2}[A-Za-z0-9]{17}$', maxLength: 26, help: 'Swiss IBANs have 21 characters and start with CH.' },
      BIC,
    ],
    depositMethods: [
      { title: 'SIC bank transfer', detail: 'Domestic transfer using your IBAN. Usually arrives the same day.' },
      { title: 'SEPA transfer in euros', detail: 'For euro payments from within the SEPA area.' },
      { title: 'International wire (SWIFT)', detail: 'For funds from overseas. Ask your banker for wire instructions.' },
    ],
  },
];

export const COUNTRY_NAMES = COUNTRIES.map((country) => country.name);

export const getCountry = (name?: string | null): Country =>
  COUNTRIES.find((country) => country.name === name) ?? COUNTRIES[0];

export const currencyFor = (countryName?: string | null): string => getCountry(countryName).currency;

/** Format an amount in any currency, e.g. formatMoney(12.5, 'GBP') -> "£12.50". */
export function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const ibanChecksumOk = (iban: string): boolean => {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = /[A-Za-z]/.test(char) ? String(char.toUpperCase().charCodeAt(0) - 55) : char;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};

/** Returns an error message for the first invalid/missing field, or null when all are valid. */
export function validatePaymentFields(country: Country, values: Record<string, string>): string | null {
  for (const field of country.fields) {
    const raw = (values[field.key] ?? '').trim();
    if (!raw) return `${field.label} is required for ${country.name}.`;
    const cleaned = raw.replace(/[\s.\-]/g, '');
    if (field.pattern && !new RegExp(field.pattern).test(cleaned)) {
      return `${field.label} doesn't look right. ${field.help ?? 'Please check it and try again.'}`;
    }
    if (field.kind === 'iban' && !ibanChecksumOk(cleaned)) {
      return `${field.label} failed the checksum. Please check every character.`;
    }
  }
  return null;
}
