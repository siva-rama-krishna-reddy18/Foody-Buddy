// src/stores/useChatStore.ts
import { create } from 'zustand'
import { connectSocket, getSocket } from '../services/socket/socketClient'
import type { ChatMessage } from 'src/types/chat'

interface ChatSession {
  id: string
  customer_id: string
  title: string
  created_at: string
  updated_at: string
}

interface BackendMessage {
  id: string
  content: string
  sender: string
  created_at: string
  message_type: string
}

interface ChatState {
  messages: ChatMessage[]
  connected: boolean
  currentSession: ChatSession | null
  customerId: string | null
  error: string | null
  connect: (customerId: string) => void
  disconnect: () => void
  sendMessage: (text: string, customerId: string) => void
  addMessage: (message: ChatMessage) => void
  loadSession: (sessionId: string, customerId: string) => Promise<void>
  renameSession: (sessionId: string, title: string, customerId: string) => Promise<void>
  setCustomerId: (customerId: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  connected: false,
  currentSession: null,
  customerId: null,
  error: null,

  setCustomerId: (customerId: string) => {
    set({ customerId })
  },

  connect: (customerId: string) => {
    console.log('Connecting with customerId:', customerId)

    const existingSocket = getSocket()
    if (existingSocket) {
      console.log('Disconnecting existing socket')
      existingSocket.disconnect()
    }

    const socket = connectSocket()

    socket.on('connect', () => {
      console.log('Socket connected')
      set({ connected: true, error: null })

      // ✅ Inject welcome message once if no messages yet
      set((state) => {
        if (state.messages.length === 0) {
          console.log('Injecting welcome message with quick actions')
          return {
            messages: [
              ...state.messages,
              {
                text: "Hello! I'm your Foody Buddy assistant. What can I do for you today?",
                sender: 'other',
                type: 'welcome', // mark this so MessageList shows quick actions
              },
            ],
          }
        }
        return state
      })
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      set({ connected: false })
    })

    socket.on('message', (data: any) => {
      console.log('Received message from server:', data)

      const chatMessage: ChatMessage = {
        text: data.message || data.content || data.text,
        sender: data.sender === 'customer' ? 'me' : 'other',
      }

      set((state) => ({ messages: [...state.messages, chatMessage] }))
    })

    socket.on('ai_response', (data: any) => {
      console.log('Received AI response:', data)

      const chatMessage: ChatMessage = {
        text: data.message || data.content || data.response,
        sender: 'other',
      }

      set((state) => ({ messages: [...state.messages, chatMessage] }))
    })

    socket.on('error', (error: any) => {
      console.error('Socket error:', error)
      set({ error: 'Connection error' })
    })

    set({ customerId })
  },

  disconnect: () => {
    getSocket()?.disconnect()
    // ⛔ Don’t clear messages here; only clear on hard reset if needed
    set({ connected: false, currentSession: null })
  },

  sendMessage: (text: string, customerId: string) => {
    console.log('Store sendMessage called with:', { text, customerId })

    const socket = getSocket()
    if (!socket || !socket.connected) {
      console.error('Socket not connected')
      set({ error: 'Not connected to chat' })
      return
    }

    if (!text.trim()) {
      return
    }

    try {
      const userMessage: ChatMessage = {
        text: text.trim(),
        sender: 'me',
      }
      set((state) => ({
        messages: [...state.messages, userMessage],
        error: null,
      }))

      const messagePayload = {
        message: text.trim(),
        content: text.trim(),
        customerId,
        phoneNumber: customerId,
        sender: 'customer',
      }

      socket.emit('message', messagePayload)
    } catch (error) {
      console.error('Error in sendMessage:', error)
      set({ error: 'Failed to send message' })
    }
  },

  addMessage: (message: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
    }))
  },

  loadSession: async (sessionId: string, customerId: string) => {
    try {
      console.log('Loading session:', { sessionId, customerId })
    } catch (error) {
      console.error('Error loading session:', error)
      set({ error: 'Failed to load session' })
    }
  },

  renameSession: async (sessionId, title, customerId) => {
    try {
      const response = await fetch(`/api/v1/chat/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          customerId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to rename session')
      }

      const data = await response.json()
      const updatedSession = data.data.session

      set({ currentSession: updatedSession })
      return updatedSession
    } catch (error) {
      console.error('Error renaming session:', error)
      throw error
    }
  },
}))