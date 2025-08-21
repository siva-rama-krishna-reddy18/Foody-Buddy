// src/stores/useChatStore.ts
import { create } from 'zustand'
import { api } from '../services/api/ApiClient'
import { connectSocket, getSocket } from '../services/socket/socketClient'
import type { ChatMessage } from 'src/types/chat'

// Update your ChatSession type to match backend response
interface ChatSession {
  id: string
  customer_id: string
  title: string
  created_at: string
  updated_at: string
  messages?: BackendMessage[]
}

// Backend message format
interface BackendMessage {
  id: string
  content: string  // Backend uses 'content', not 'text'
  sender: string   // 'customer' or 'ai'
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
  sendMessage: (text: string, customerId: string) => void  // Fixed: now accepts customerId
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
    
    // Disconnect any existing connection first
    const existingSocket = getSocket()
    if (existingSocket) {
      console.log('Disconnecting existing socket')
      existingSocket.disconnect()
    }
    
    const socket = connectSocket()
    
    socket.on('connect', () => {
      console.log('Socket connected')
      set({ connected: true, error: null })
      
      // Authenticate with backend using customerId
      console.log('Authenticating with phoneNumber:', customerId)
      socket.emit('authenticate', { phoneNumber: customerId })
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      set({ connected: false })
    })

    socket.on('authenticated', (data: any) => {
      console.log('Authenticated:', data)
      // Don't automatically load session - let user messages trigger responses
    })

    socket.on('message', (data: any) => {
      console.log('Received message from server:', data)
      
      // Convert backend message format to frontend format
      const chatMessage: ChatMessage = {
        text: data.message || data.content || data.text,
        sender: data.sender === 'customer' ? 'me' : 'other',
      }
      
      console.log('Adding received message to store:', chatMessage)
      set((state) => ({ messages: [...state.messages, chatMessage] }))
    })

    // Listen for AI responses specifically
    socket.on('ai_response', (data: any) => {
      console.log('Received AI response:', data)
      
      const chatMessage: ChatMessage = {
        text: data.message || data.content || data.response,
        sender: 'other',
      }
      
      console.log('Adding AI response to store:', chatMessage)
      set((state) => ({ messages: [...state.messages, chatMessage] }))
    })

    socket.on('error', (error: any) => {
      console.error('Socket error:', error)
      set({ error: 'Connection error' })
    })

    // Store the customerId for later use
    set({ customerId })
  },

  disconnect: () => {
    getSocket()?.disconnect()
    set({ connected: false, messages: [], currentSession: null })
  },

  // Fixed sendMessage function
  sendMessage: (text: string, customerId: string) => {
    console.log('Store sendMessage called with:', { text, customerId })
    
    const socket = getSocket()
    if (!socket || !socket.connected) {
      console.error('Socket not connected')
      set({ error: 'Not connected to chat' })
      return
    }

    if (!text.trim()) {
      console.log('Empty message, not sending')
      return
    }

    try {
      // FIRST: Add message to local state immediately for better UX
      const userMessage: ChatMessage = { 
        text: text.trim(), 
        sender: 'me' 
      }
      console.log('Adding user message to store:', userMessage)
      set((state) => ({ 
        messages: [...state.messages, userMessage],
        error: null
      }))

      // THEN: Send message to backend
      const messagePayload = {
        message: text.trim(),    // Try 'message' field
        content: text.trim(),    // Also try 'content' field
        customerId: customerId,
        phoneNumber: customerId, // Also try phoneNumber
        sender: 'customer'
      }
      
      console.log('Emitting message to socket:', messagePayload)
      socket.emit('message', messagePayload)

    } catch (error) {
      console.error('Error in sendMessage:', error)
      set({ error: 'Failed to send message' })
    }
  },

  addMessage: (message: ChatMessage) => {
    set((state) => ({ 
      messages: [...state.messages, message] 
    }))
  },

  loadSession: async (sessionId: string, customerId: string) => {
    try {
      console.log('Loading session:', { sessionId, customerId })
      // You can implement this later when needed
      // For now, just log that it was called
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
          customerId
        })
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