import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket() {
  const WS_URL = import.meta.env.VITE_WS_URL;
  socket = io(WS_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
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