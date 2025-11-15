// src/pages/Chat.tsx
import React, { useState } from 'react';
import ChatContainer from '../components/chat/ChatContainer';
import ConnectionTest from '../components/chat/ConnectionStatus';

export default function Chat() {
  const [customerId] = useState(() => {
    // Get or generate customer ID
    const stored = localStorage.getItem('customerId');
    if (stored) return stored;
    
    const newId = `customer_${Date.now()}`;
    localStorage.setItem('customerId', newId);
    return newId;
  });

  const [showTest, setShowTest] = useState(true);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Connection Test (remove after testing) */}
      {showTest && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <button
            onClick={() => setShowTest(false)}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
          <ConnectionTest />
        </div>
      )}
      
      <ChatContainer customerId={customerId} />
    </div>
  );
}