import { useEffect } from 'react';
import ChatContainer from '../components/chat/ChatContainer';
import { useChatStore } from '../stores/useChatStore';

export default function Chat() {
  const connect = useChatStore((state) => state.connect);
  const disconnect = useChatStore((state) => state.disconnect);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className="h-screen flex justify-center items-center">
      <ChatContainer />
    </div>
  );
}