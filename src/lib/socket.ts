// src/lib/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
    });

    socketInstance.on('connect', () => {
      console.log("✅ [Socket] Connected:", socketInstance?.id);
    });

    socketInstance.on('disconnect', () => {
      console.log("❌ [Socket] Disconnected");
    });

    // 🔹 LangChain responses
    socketInstance.on('langchain-response', (data: any) => {
      console.log("🤖 [Socket] LangChain response received:", data);
      // No need to dispatch a browser event — useChatStore listens directly to this
    });

    // 🔹 Regular bot messages
    socketInstance.on('bot-message', (data: any) => {
      console.log("💬 [Socket] bot-message received:", data);
      // useChatStore handles this directly
    });

    // 🔹 Optional: Log other events for debugging
    socketInstance.on('coupon-applied', (data) => {
      console.log("🏷️ [Socket] coupon-applied:", data);
    });

    socketInstance.on('order-tracking', (data) => {
      console.log("📦 [Socket] order-tracking:", data);
    });
  }

  return socketInstance;
};

// Export singleton socket instance
export const socket: Socket = getSocket();
export default socket;
