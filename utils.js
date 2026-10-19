// Generate Default Transaction History for Users
import { generateRandomDate, generateRandomAmount, generateRandomCountry } from './utils';

export const generateDefaultHistory = (userId) => {
  const history = [];
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  // Generate 100+ transactions over two years
  for (let i = 0; i < 100; i++) {
    const date = generateRandomDate(startDate, new Date());
    const amount = generateRandomAmount();
    const country = generateRandomCountry();
    const type = Math.random() > 0.5 ? 'credit' : 'debit';

    history.push({
      id: `${userId}-tx-${i + 1}`,
      date: date.toISOString().split('T')[0],
      amount: amount.toFixed(2),
      country: country,
      type: type,
      description: `Transfer to ${country} - ${type.charAt(0).toUpperCase() + type.slice(1)}`
    });
  }

  return history;
};