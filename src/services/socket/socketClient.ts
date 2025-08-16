import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket() {
  // FIXED: Use http:// instead of ws:// for Socket.IO
  // const WS_URL = import.meta.env.VITE_WS_URL;
  const WS_URL = 'http://127.0.0.1:3001';
  
  socket = io(WS_URL, { 
    transports: ['websocket', 'polling'], // Allow both transports for reliability
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    console.log('Socket ID:', socket?.id);
    
    // Authenticate immediately after connection
    socket?.emit('authenticate', { 
      phoneNumber: '+1234567890' // Replace with actual phone number
    });
  });

  socket.on('authenticated', (data) => {
    console.log('Authentication successful:', data);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
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
  }
}

// Helper function to send messages
export function sendMessage(message: string) {
  if (socket && socket.connected) {
    socket.emit('message', { 
      message: message,
      timestamp: new Date()
    });
    console.log('Message sent:', message);
  } else {
    console.error('Socket not connected');
  }
}