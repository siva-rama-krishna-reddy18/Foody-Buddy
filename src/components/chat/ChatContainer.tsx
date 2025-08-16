import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ConnectionStatus from './ConnectionStatus';

export default function ChatContainer() {
  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border rounded-lg">
      <ConnectionStatus />
      <MessageList />
      <MessageInput />
    </div>
  );
}