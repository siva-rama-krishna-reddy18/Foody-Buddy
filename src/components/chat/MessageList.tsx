import { useChatStore } from '../../stores/useChatStore';
import MessageBubble from './MessageBubble';

export default function MessageList() {
  const messages = useChatStore((state) => state.messages);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.map((msg, idx) => (
        <MessageBubble key={idx} text={msg.text} sender={msg.sender} />
      ))}
    </div>
  );
}