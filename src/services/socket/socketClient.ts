// src/services/socket/socketService.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
const WS_URL = import.meta.env.VITE_WS_URL || 'http://127.0.0.1:3000';

export function connectSocket(customerId: string) {
  if (socket) {
    return socket; // Already connected
  }

  console.log('🔌 Connecting to WebSocket:', WS_URL);

  socket = io(WS_URL, { 
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000
  });

  socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server');
    console.log('Socket ID:', socket?.id);
    
    // Identify with backend
    socket?.emit('identify', { 
      customerId: customerId
    });
  });

  socket.on('identified', (data) => {
    console.log('✅ Identified:', data);
  });

  socket.on('message', (data) => {
    console.log('📨 Message received:', data);
    // Handle incoming messages
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from WebSocket server');
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Socket disconnected');
  }
}

// Send chat message via WebSocket
export function sendChatMessage(data: {
  sessionId: string;
  customerId: string;
  text: string;
}) {
  if (socket && socket.connected) {
    socket.emit('message', data);
    console.log('📤 Message sent via WebSocket:', data);
    return true;
  } else {
    console.error('❌ Socket not connected');
    return false;
  }
}

// Listen for AI responses
export function onAIResponse(callback: (data: any) => void) {
  if (socket) {
    socket.on('ai_response', callback);
  }
}