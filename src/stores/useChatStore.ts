import { create } from 'zustand'
import socket from '../services/socket/socketClient'

export interface Message {
  text: string
  sender: 'me' | 'other'
}

interface ChatState {
  messages: Message[]
  connected: boolean
  connectSocket: () => void
  disconnectSocket: () => void
  sendMessage: (text: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  connected: false,

  connectSocket: () => {
    socket.connect()

    socket.on('connect', () => {
      set({ connected: true })
    })

    socket.on('disconnect', () => {
      set({ connected: false })
    })

    socket.on('message', (msg: { text: string; sender: string }) => {
      set((state) => ({
        messages: [...state.messages, { text: msg.text, sender: 'other' }],
      }))
    })
  },

  disconnectSocket: () => {
    socket.disconnect()
    set({ connected: false })
  },

  sendMessage: (text) => {
    // Emit to backend
    socket.emit('message', { text })
    // Add locally so it appears instantly
    set((state) => ({
      messages: [...state.messages, { text, sender: 'me' }],
    }))
  },
}))