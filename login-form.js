// Login System Component
import React, { useState } from 'react';
import { loginSystem } from './login-system';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Simulate login
    if (username === 'admin' && password === 'admin123') {
      const generatedCode = loginSystem.generateCode();
      setStatus(`Code generated: ${generatedCode}`);
      // Store code securely in state or database
    } else {
      setStatus('Invalid credentials');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Verification Code" />
        <button type="submit">Login</button>
      </form>
      <p>{status}</p>
    </div>
  );
};

export default LoginForm;