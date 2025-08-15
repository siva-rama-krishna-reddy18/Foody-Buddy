import { AuthService } from './AuthService'

// (Optional) Placeholder ChatService for REST history, etc.
class ChatService {
  async getHistory(sessionId: string) {
  console.log('Fetching chat history for session:', sessionId) // Mock for now
  await new Promise(r => setTimeout(r, 300))
  return [
    { text: `Welcome to chat session ${sessionId}!`, sender: 'other' as const },
    { text: 'Thanks, happy to be here.', sender: 'me' as const },
  ]
}
}

export class ApiClient {
  auth: AuthService
  chat: ChatService
  constructor() {
    this.auth = new AuthService()
    this.chat = new ChatService()
  }
}

export const api = new ApiClient()