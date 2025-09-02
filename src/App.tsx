// src/App.tsx
import React, { useState, useEffect } from 'react';
import ChatContainer from './components/chat/ChatContainer';
import './App.css';

function App() {
  const [customerId, setCustomerId] = useState<string>('+1234567890');

  // Initialize with environment or authentication
  useEffect(() => {
    const savedCustomerId = localStorage.getItem('foodbuddy_customer_id');
    if (savedCustomerId) {
      setCustomerId(savedCustomerId);
    }
  }, []);

  // Save customer ID when it changes
  useEffect(() => {
    if (customerId) {
      localStorage.setItem('foodbuddy_customer_id', customerId);
    }
  }, [customerId]);

  return (
    <div className="App">
      <ChatContainer customerId={customerId} />
    </div>
  );
}

export default App;