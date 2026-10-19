// Bank UI Component
import React from 'react';

const BankUI = () => {
  return (
    <div>
      <header>
        <h1>First Bank & Trust</h1>
        <p>Secure Your Future</p>
      </header>
      <main>
        <div>
          <h2>Account Overview</h2>
          <p>Balance: $1,234,567.89</p>
          <p>Account Type: Business</p>
          <p>Location: New York, NY</p>
        </div>
        <div>
          <h2>Recent Transactions</h2>
          <ul>
            <li>Wire Transfer to Germany - $50,000</li>
            <li>Payment Received - $25,000</li>
          </ul>
        </div>
      </main>
      <footer>
        <p>Contact Us: (3) 123-4567</p>
        <p>Email: info@firstbanktrust.com</p>
      </footer>
    </div>
  );
};

export default BankUI;