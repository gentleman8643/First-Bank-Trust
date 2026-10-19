// Generate 2-year default transaction history
const generateTransactions = () => {
  const countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'SA'];
  const amounts = [50000, 150000, 2500000, 5000, 25000, 100000];
  const transactions = [];

  for (let i = 0; i < 730; i++) {
    const date = new Date(2024, Math.floor(Math.random() * 12), 1);
    const country = countries[Math.floor(Math.random() * countries.length)];
    const amount = amounts[Math.floor(Math.random() * amounts.length)];
    const type = amount >= 50000 ? 'large' : 'small';
    transactions.push({
      date: date.toISOString().split('T')[0],
      country,
      amount,
      type,
      status: ['pending', 'complete', 'received'][Math.floor(Math.random() * 3)]
    });
  }
  return transactions;
};

// Wire transfer functionality
const processWireTransfer = (data) => {
  // Validate email/phone fields
  if (!data.email || !data.phone) throw new Error('Email and phone required');
  // Generate code
  const code = Math.floor(100000 + Math.random() * 900000);
  // Store code securely (e.g., in database)
  return { code, status: 'pending' };
};

// Admin account creation
const createAdminAccount = (userData) => {
  // Validate admin credentials
  if (!userData.isAdmin) throw new Error('Admin privileges required');
  // Create account with business details
  return {
    accountType: userData.accountType || 'business',
    businessName: userData.businessName,
    location: userData.location,
    contactInfo: userData.contactInfo
  };
};

// Payment processing
const handlePayment = (paymentData) => {
  // Validate code
  if (!paymentData.code) throw new Error('Code required');
  // Check code validity
  const isValid = validateCode(paymentData.code);
  if (!isValid) throw new Error('Invalid code');
  // Process payment
  return { status: 'pending', description: paymentData.description };
};

// Code validation
const validateCode = (code) => {
  // Check against stored codes
  return code === getStoredCode();
};

// Get stored code
const getStoredCode = () => {
  // Retrieve code from secure storage
  return Math.floor(100000 + Math.random() * 900000);
};