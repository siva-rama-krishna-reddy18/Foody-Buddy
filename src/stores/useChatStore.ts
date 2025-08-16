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
    
    // FIXED: Listen for 'message' event (not 'chat_message')
    socket.on('message', (data: any) => {
      console.log('Received message from backend:', data);
      
      // Convert backend message format to your ChatMessage format
      const chatMessage: ChatMessage = {
        text: data.message || data.text,
        sender: data.sender === 'customer' ? 'me' : 'other'
      };
      
      set((state) => ({ 
        messages: [...state.messages, chatMessage] 
      }));
    });

    // Listen for authentication success
    socket.on('authenticated', (data: any) => {
      console.log('Authentication successful:', data);
    });

    // Listen for errors
    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  },

  disconnect: () => {
    getSocket()?.disconnect();
    set({ connected: false });
  },

  sendMessage: (text) => {
    const socket = getSocket();
    if (socket && text.trim()) {
      console.log('Sending message:', text);
      
      // FIXED: Send in the format your backend expects
      socket.emit('message', { message: text.trim() });
      
      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        text: text.trim(),
        sender: 'me'
      };
      
      set((state) => ({
        messages: [...state.messages, userMessage],
      }));
    }
  },

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }));
  }
}));