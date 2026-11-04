// Generates a long, realistic-looking statement history for the "pre-built history" feature.
// Merchant names are fictional and varied; only things that really recur (rent, salary, bills,
// subscriptions) repeat. Amounts are scaled to the customer's currency.

export type HistoryEntry = {
  merchant: string;
  amount: number;
  direction: 'in' | 'out';
  category: string;
  note?: string;
  /** ISO timestamp */
  date: string;
};

const CURRENCY_SCALE: Record<string, number> = { USD: 1, CAD: 1.35, GBP: 0.8, EUR: 0.92, AUD: 1.5, JPY: 150, BRL: 5, SGD: 1.35, CHF: 0.9, MXN: 18 };

const FIRST = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Harper', 'Elliot', 'Rowan', 'Sasha', 'Noor', 'Mateo', 'Priya', 'Hiro', 'Lena', 'Omar', 'Sofia', 'Daniel', 'Amara', 'Kofi', 'Ingrid', 'Mei', 'Lucas'];
const LAST = ['Carter', 'Nguyen', 'Okafor', 'Silva', 'Haddad', 'Kowalski', 'Tanaka', 'Rossi', 'Mehta', 'Larsen', 'Brooks', 'Alvarez', 'Dubois', 'Schmidt', 'Reyes', 'Fischer', 'Campbell', 'Ibrahim', 'Moreau', 'Park'];
const STREETS = ['Maple', 'Cedar', 'Lakeview', 'Harbor', 'Elm', 'Highland', 'Riverside', 'Park', 'Sunset', 'Willow', 'Union', 'Station', 'Market', 'Orchard', 'Bridge', 'Mill'];
const PLACES = ['Maple', 'Harbor', 'Greenfield', 'Oakwood', 'Sunrise', 'Riverside', 'Cedar', 'Willow', 'Northgate', 'Lakeside', 'Meadow', 'Hillcrest', 'Evergreen', 'Brightway', 'Pinecrest', 'Stonebridge', 'Golden', 'Wildflower', 'Copperfield', 'Bluebird', 'Fairview', 'Ashford', 'Silverleaf', 'Redwood', 'Summit'];
const EMPLOYERS = ['Logistics', 'Technologies', 'Health Group', 'Education Trust', 'Foods', 'Engineering', 'Media', 'Construction', 'Retail Group', 'Energy'];
const SUBSCRIPTIONS = ['StreamBox Premium', 'TuneWave Music', 'CloudVault Storage', 'PixelPress News', 'FitTrack Pro', 'ReadLoop Books', 'GameForge Pass', 'CookBook+ Recipes'];
const P2P_NOTES = ['Dinner split', 'Rent share', 'Birthday gift', 'Thanks!', 'Groceries', 'Concert tickets', 'Repayment', 'Weekend trip'];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateHistory(options: { currency: string; months?: number; seed?: number; now?: Date }): HistoryEntry[] {
  const now = options.now ?? new Date();
  const months = options.months ?? 24;
  const rnd = mulberry32(options.seed ?? Math.floor(Math.random() * 2147483647));
  const scale = CURRENCY_SCALE[options.currency] ?? 1;

  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
  const between = (min: number, max: number) => min + rnd() * (max - min);
  const chance = (p: number) => rnd() < p;
  const money = (usd: number) => {
    const value = usd * scale;
    return options.currency === 'JPY' ? Math.max(1, Math.round(value)) : Math.max(0.01, Math.round(value * 100) / 100);
  };
  const person = () => `${pick(FIRST)} ${pick(LAST)}`;

  // Avoid showing the same random merchant twice within a short stretch.
  const recent: string[] = [];
  const fresh = (make: () => string): string => {
    let name = make();
    for (let attempt = 0; attempt < 12 && recent.includes(name); attempt += 1) name = make();
    recent.push(name);
    if (recent.length > 40) recent.shift();
    return name;
  };

  const makers: Record<string, () => string> = {
    Groceries: () => `${pick(PLACES)} ${pick(['Market', 'Grocery', 'Foods', 'Fresh Mart', 'Supermarket', 'Greengrocer'])}`,
    Dining: () => `${pick(['Luna', 'Saffron', 'Blue Fig', 'Copper Kettle', 'Olive & Vine', 'Smoke & Ember', 'Golden Spoon', 'Little Lantern', 'Basil Leaf', 'Harvest', 'Coastal', 'Juniper', 'Velvet', 'Ember', 'Marigold', 'Cobalt', 'Thistle', 'Paprika', 'Wildfire', 'Nori'])} ${pick(['Bistro', 'Kitchen', 'Café', 'Grill', 'Trattoria', 'Diner', 'Taqueria', 'Noodle Bar', 'Bakery', 'Pizzeria', 'Steakhouse', 'Tapas'])}`,
    Fuel: () => `${pick(['Northline', 'Central', 'Summit', 'Eagle', 'Blue Pump', 'Roadside', 'Highway 9', 'Prime', 'Redline', 'Westfield'])} ${pick(['Fuel', 'Petrol Station', 'Gas & Go', 'Service Station'])}`,
    Transport: () => pick([`${pick(PLACES)} Metro fare`, `${pick(PLACES)} Parking Garage`, 'Rideshare trip', `${pick(PLACES)} Taxi`, 'Airport shuttle', 'Bike share ride', 'Intercity rail ticket', 'Toll road charge']),
    Shopping: () => `${pick(PLACES)} ${pick(['Outfitters', 'Home Goods', 'Electronics', 'Books', 'Hardware', 'Boutique', 'Garden Centre', 'Sports', 'Toys', 'Furniture', 'Stationers', 'Pet Supply'])}`,
    Health: () => pick([`${pick(PLACES)} Pharmacy`, `${pick(PLACES)} Medical Clinic`, `${pick(['Bright', 'Clear', 'Gentle'])} Smile Dental`, `${pick(PLACES)} Optical`, `${pick(PLACES)} Physio`]),
    Entertainment: () => `${pick(PLACES)} ${pick(['Cinema', 'Theatre', 'Bowling', 'Arcade', 'Concert Hall', 'Museum', 'Comedy Club', 'Climbing Gym'])}`,
    Travel: () => pick([`${pick(['Skyline', 'Horizon', 'Meridian', 'Coastal'])} Airlines`, `${pick(PLACES)} Grand Hotel`, `${pick(PLACES)} Resort & Spa`, 'Voyage Car Rental', `${pick(PLACES)} Inn`]),
    'ATM withdrawal': () => `ATM withdrawal · ${pick(STREETS)} Street`,
  };

  const spendWeights: [string, number][] = [
    ['Groceries', 24], ['Dining', 20], ['Shopping', 10], ['Transport', 9], ['Fuel', 7], ['Health', 4],
    ['Entertainment', 6], ['ATM withdrawal', 5], ['P2P out', 5], ['Deposit', 4], ['P2P in', 2], ['Travel', 1.5],
  ];
  const totalWeight = spendWeights.reduce((sum, [, weight]) => sum + weight, 0);
  const pickCategory = () => {
    let roll = rnd() * totalWeight;
    for (const [category, weight] of spendWeights) { roll -= weight; if (roll <= 0) return category; }
    return 'Groceries';
  };

  const entries: HistoryEntry[] = [];
  const at = (day: Date, hour = 7 + Math.floor(rnd() * 14)): string | null => {
    const stamp = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, Math.floor(rnd() * 60));
    return stamp.getTime() > now.getTime() ? null : stamp.toISOString();
  };
  const add = (day: Date, entry: Omit<HistoryEntry, 'date'>, hour?: number) => {
    const date = at(day, hour);
    if (date) entries.push({ ...entry, date });
  };

  // Things that genuinely recur, fixed per customer.
  const employer = `${pick(PLACES)} ${pick(EMPLOYERS)} Payroll`;
  const salary = money(between(1800, 4200));
  const rent = money(between(850, 2300));
  const rentLabel = `${pick(PLACES)} Property Management · Rent`;
  const bills = [
    { name: `${pick(PLACES)} Power & Light`, base: between(55, 170), vary: true, day: 5 + Math.floor(rnd() * 20) },
    { name: `${pick(PLACES)} Water Works`, base: between(25, 65), vary: true, day: 5 + Math.floor(rnd() * 20) },
    { name: `${pick(PLACES)} Fibre Broadband`, base: between(45, 85), vary: false, day: 5 + Math.floor(rnd() * 20) },
    { name: `${pick(PLACES)} Mobile`, base: between(30, 75), vary: false, day: 5 + Math.floor(rnd() * 20) },
  ].map((bill) => ({ ...bill, fixedAmount: money(bill.base) }));
  const subs = [...SUBSCRIPTIONS].sort(() => rnd() - 0.5).slice(0, 3).map((name) => ({ name, price: money(between(4.99, 19.99)), day: 1 + Math.floor(rnd() * 27) }));

  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  let payFriday = 0;

  for (let day = new Date(start); day <= now; day.setDate(day.getDate() + 1)) {
    const current = new Date(day);
    const dom = current.getDate();
    const weekday = current.getDay();

    // Pay every second Friday.
    if (weekday === 5) {
      payFriday += 1;
      if (payFriday % 2 === 0) add(current, { merchant: employer, amount: salary, direction: 'in', category: 'Salary', note: 'Salary' }, 6);
    }
    if (dom === 1 + (rentLabel.length % 3)) add(current, { merchant: rentLabel, amount: rent, direction: 'out', category: 'Housing' }, 9);
    bills.forEach((bill) => {
      if (dom === bill.day) add(current, { merchant: bill.name, amount: bill.vary ? money(bill.base * between(0.8, 1.25)) : bill.fixedAmount, direction: 'out', category: 'Utilities' }, 8);
    });
    subs.forEach((sub) => {
      if (dom === sub.day) add(current, { merchant: sub.name, amount: sub.price, direction: 'out', category: 'Subscriptions' }, 4);
    });
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    if (dom === lastDay) add(current, { merchant: 'Interest payment', amount: money(between(0.3, 12)), direction: 'in', category: 'Interest' }, 3);

    // Everyday spending: busier on weekends.
    const weekend = weekday === 0 || weekday === 6;
    const roll = rnd();
    const count = weekend ? (roll < 0.2 ? 0 : roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3) : (roll < 0.3 ? 0 : roll < 0.75 ? 1 : roll < 0.95 ? 2 : 3);
    for (let i = 0; i < count; i += 1) {
      const category = pickCategory();
      switch (category) {
        case 'Groceries': add(current, { merchant: fresh(makers.Groceries), amount: money(between(14, 140)), direction: 'out', category }); break;
        case 'Dining': add(current, { merchant: fresh(makers.Dining), amount: money(between(7, 95)), direction: 'out', category }); break;
        case 'Shopping': add(current, { merchant: fresh(makers.Shopping), amount: money(between(12, 260)), direction: 'out', category }); break;
        case 'Transport': add(current, { merchant: fresh(makers.Transport), amount: money(between(3, 55)), direction: 'out', category }); break;
        case 'Fuel': add(current, { merchant: fresh(makers.Fuel), amount: money(between(25, 78)), direction: 'out', category: 'Transport' }); break;
        case 'Health': add(current, { merchant: fresh(makers.Health), amount: money(between(9, 320)), direction: 'out', category }); break;
        case 'Entertainment': add(current, { merchant: fresh(makers.Entertainment), amount: money(between(9, 90)), direction: 'out', category }); break;
        case 'ATM withdrawal': add(current, { merchant: fresh(makers['ATM withdrawal']), amount: money(Math.round(between(20, 300) / 20) * 20), direction: 'out', category: 'Cash' }); break;
        case 'P2P out': add(current, { merchant: `Transfer to ${person()}`, amount: money(between(10, 220)), direction: 'out', category: 'Transfers', note: pick(P2P_NOTES) }); break;
        case 'P2P in': add(current, { merchant: `Payment from ${person()}`, amount: money(between(10, 260)), direction: 'in', category: 'Transfers', note: pick(P2P_NOTES) }); break;
        case 'Travel': add(current, { merchant: fresh(makers.Travel), amount: money(between(140, 1700)), direction: 'out', category }); break;
        case 'Deposit': {
          const kind = pick(['Mobile check deposit', `Cash deposit · ${pick(STREETS)} St branch`, `Wire in · ${pick(PLACES)} ${pick(['Consulting', 'Studio', 'Labs', 'Partners', 'Design', 'Trading'])}`, `Refund · ${fresh(makers.Shopping)}`, 'Transfer from savings']);
          const isRefund = kind.startsWith('Refund');
          add(current, { merchant: fresh(() => kind), amount: money(isRefund ? between(8, 240) : between(60, 2200)), direction: 'in', category: isRefund ? 'Refund' : 'Deposit' });
          break;
        }
        default: break;
      }
    }
  }

  return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
}
