// src/lib/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

console.log('🔌 Initializing Socket.IO client');
console.log('📡 Connecting to:', SOCKET_URL);

export const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Connection event logging
socket.on('connect', () => {
  console.log('✅ Socket.IO connected successfully');
  console.log('🆔 Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket.IO disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.IO connection error:', error.message);
});

export default socket;