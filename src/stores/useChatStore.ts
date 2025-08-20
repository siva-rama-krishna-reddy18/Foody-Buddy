// src/stores/useChatStore.ts
import { create } from 'zustand'
import { api } from '../services/api/ApiClient'
import { connectSocket, getSocket } from '../services/socket/socketClient'
import type { ChatMessage } from 'src/types/chat'
import type { ChatSession } from '../services/api/ApiClient'

interface ChatState {
  messages: ChatMessage[]
  connected: boolean
  currentSession: ChatSession | null
  connect: () => void
  disconnect: () => void
  sendMessage: (text: string) => void
  addMessage: (message: ChatMessage) => void
  loadSession: (sessionId: string, customerId: string) => Promise<void>
  renameSession: (sessionId: string, title: string, customerId: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  connected: false,
  currentSession: null,

  connect: () => {
    const socket = connectSocket()
    socket.on('connect', () => set({ connected: true }))
    socket.on('disconnect', () => set({ connected: false }))

    socket.on('message', (data: any) => {
      const chatMessage: ChatMessage = {
        text: data.message || data.text,
        sender: data.sender === 'customer' ? 'me' : 'other',
      }
      set((state) => ({ messages: [...state.messages, chatMessage] }))
    })
  },

  disconnect: () => {
    getSocket()?.disconnect()
    set({ connected: false })
  },

  sendMessage: (text) => {
    const socket = getSocket()
    if (socket && text.trim()) {
      socket.emit('message', { message: text.trim() })
      const userMessage: ChatMessage = { text: text.trim(), sender: 'me' }
      set((state) => ({ messages: [...state.messages, userMessage] }))
    }
  },

  addMessage: (message) => {
    set((state) => ({ messages: [...state.messages, message] }))
  },

  loadSession: async (sessionId, customerId) => {
    const session = await api.chat.getHistory(sessionId, customerId)
    set({
      currentSession: session,
      messages: session.messages?.map((m) => ({
        text: m.text,
        sender: m.sender === 'customer' ? 'me' : 'other',
      })) || [],
    })
  },

  renameSession: async (sessionId, title, customerId) => {
    const updated = await api.chat.renameSession(sessionId, title, customerId)
    set({ currentSession: updated })
  },
}))