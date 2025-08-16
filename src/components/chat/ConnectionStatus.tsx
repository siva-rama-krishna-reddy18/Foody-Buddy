import { useChatStore } from '../../stores/useChatStore';

export default function ConnectionStatus() {
  const connected = useChatStore((state) => state.connected);
  return (
    <div className="p-2 text-sm flex items-center gap-2 border-b">
      <span
        className={`w-3 h-3 rounded-full ${
          connected ? 'bg-green-500' : 'bg-red-500'
        }`}
      ></span>
      {connected ? 'Connected' : 'Disconnected'}
    </div>
  );
}