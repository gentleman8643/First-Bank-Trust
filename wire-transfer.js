// Wire Transfer Form Component
import React, { useState } from 'react';
import { processWireTransfer } from './admin-panel';

const WireTransferForm = () => {
  const [country, setCountry] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('pending');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!email || !phone) {
      alert('Email and phone are required');
      return;
    }
    
    // Generate code
    const generatedCode = Math.floor(100000 + Math.random() * 900000);
    
    // Process transfer
    const result = processWireTransfer({
      country,
      amount: parseFloat(amount),
      description,
      code: generatedCode,
      email,
      phone,
      status
    });

    // Store result
    setStatus(result.status);
    alert(`Transfer submitted with code: ${generatedCode}`);
  };

  return (
    <div>
      <h2>Wire Transfer</h2>
      <form onSubmit={handleSubmit}>
        <select value={country} onChange={(e) => setCountry(e.target.value)} required>
          <option value="">Select Country</option>
          <option value="US">United States</option>
          <option value="UK">United Kingdom</option>
          <option value="CA">Canada</option>
          <option value="AU">Australia</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="JP">Japan</option>
          <option value="IN">India</option>
          <option value="BR">Brazil</option>
          <option value="SA">Saudi Arabia</option>
        </select>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
        <button type="submit">Submit Transfer</button>
      </form>
      <p>Status: {status}</p>
    </div>
  );
};

export default WireTransferForm;