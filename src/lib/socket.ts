// src/lib/socket.ts
// ✅ CORRECTED VERSION - Connects to the right backend

import { io, Socket } from 'socket.io-client';

// ✅ Your backend is on port 3000, not 5000!
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

console.log('🔌 Initializing Socket.IO client');
console.log('📡 Connecting to:', SOCKET_URL);

// ✅ Create singleton socket instance
let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      // ✅ Start with polling (more reliable), then upgrade to websocket
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // ✅ Prevent multiple connections
      forceNew: false,
      multiplex: true,
      upgrade: true,
    });

    // Connection event logging
    socketInstance.on('connect', () => {
      console.log('✅ Socket.IO connected successfully');
      console.log('🆔 Socket ID:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
    });
  }

  return socketInstance;
};

// ✅ Export the socket
export const socket: Socket = getSocket();

export default socket;