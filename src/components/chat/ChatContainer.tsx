// src/components/chat/ChatContainer.tsx
import { useEffect } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import ConnectionStatus from './ConnectionStatus';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import QuickActions from './QuickActions';

export default function ChatContainer() {
  // Hardcoded values for now (replace later with props or user context)
  const sessionId = '68320f7c-5f09-4956-b211-218bc3245659';
  const customerId = '+1234567890';

  const { connect, disconnect } = useChatStore();

  // Connect to socket when mounted
  useEffect(() => {
    console.log('ChatContainer: Connecting with customerId:', customerId);
    connect(customerId);

    return () => {
      console.log('ChatContainer: Cleaning up - disconnecting');
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-white border rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          🤖
        </div>
        <div>
          <h3 className="font-semibold">FoodBot Assistant</h3>
          <p className="text-sm opacity-80">Your personal food ordering companion</p>
        </div>
      </div>

      {/* Connection Status */}
      <ConnectionStatus />

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        {/* Initial Welcome Message + Quick Actions */}
        <div className="flex gap-2 items-start">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">🤖</div>
          <div className="bg-gray-100 p-3 rounded-2xl text-sm text-gray-700 max-w-[80%]">
            Welcome to Foody Buddy! I'm here to help you order delicious meals.  
            What can I do for you today?
            <QuickActions />
          </div>
        </div>

        <MessageList />
      </div>

      {/* Input */}
      <MessageInput customerId={customerId} />
    </div>
  );
}