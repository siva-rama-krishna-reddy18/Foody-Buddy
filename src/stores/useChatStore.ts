import { create } from 'zustand';
import { api } from '../services/api/ApiClient';
import { connectSocket, getSocket } from '../services/socket/socketClient';
import type { ChatMessage } from 'src/types/chat';

interface ChatState {
  messages: ChatMessage[];
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (text: string) => void;
  addMessage: (message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  connected: false,

  connect: () => {
    const socket = connectSocket();
    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));
    socket.on('chat_message', (msg: ChatMessage) => {
      set((state) => ({ messages: [...state.messages, msg] }));
    });
  },

  disconnect: () => {
    getSocket()?.disconnect();
    set({ connected: false });
  },

  sendMessage: (text) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('chat_message', { text, sender: 'me' });
      set((state) => ({
        messages: [...state.messages, { text, sender: 'me' }],
      }));
    }
  },

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
  }
}));