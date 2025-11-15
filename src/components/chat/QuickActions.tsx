// src/components/chat/QuickActions.tsx
import { useChatStore } from '../../stores/useChatStore';

export default function QuickActions() {
  const { sendMessage, customerId } = useChatStore();

  if (!customerId) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-2">
      <button
        onClick={() => sendMessage("I'd like to see the menu", customerId)}
        className="bg-indigo-600 hover:bg-indigo-800 text-white text-xs px-3 py-1.5 rounded-full transition"
      >
        View Menu
      </button>
      <button
        onClick={() => sendMessage("Can you help me track my order?", customerId)}
        className="bg-indigo-600 hover:bg-indigo-800 text-white text-xs px-3 py-1.5 rounded-full transition"
      >
        Track Orders
      </button>
      <button
        onClick={() => sendMessage("What are today's specials?", customerId)}
        className="bg-indigo-600 hover:bg-indigo-800 text-white text-xs px-3 py-1.5 rounded-full transition"
      >
        Today's Specials
      </button>
    </div>
  );
}