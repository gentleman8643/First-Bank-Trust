export type Account = {
  id: string;
  name: string;
  number: string;
  type: string;
  balance: number;
  available: number;
  currency: string;
  /** Type-specific facts: card number, APR, loan terms, etc. (see lib/accounts.ts) */
  details: Record<string, any>;
};

export type UserProfile = {
  name: string;
  username: string;
  email: string;
  phone: string;
  country: string;
  role: 'admin' | 'customer';
};
