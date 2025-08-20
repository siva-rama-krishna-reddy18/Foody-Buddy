// src/services/api/ApiClient.ts

// Session + Chat types (adjust as needed)
export interface ChatSession {
  id: string
  title: string
  customerId: string
  messages?: Array<{
    id: string
    sender: string
    text: string
    createdAt: string
  }>
  _count?: { messages: number }
}

class ChatService {
  async getHistory(sessionId: string, customerId: string) {
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/chat/sessions/${sessionId}/details?customerId=${encodeURIComponent(customerId)}`
    )
    if (!res.ok) throw new Error('Failed to fetch session details')
    return res.json() as Promise<ChatSession>
  }

  async renameSession(sessionId: string, title: string, customerId: string) {
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/chat/sessions/${sessionId}/title`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, customerId }),
      }
    )
    if (!res.ok) throw new Error('Failed to rename session')
    return res.json() as Promise<ChatSession>
  }
}

export class ApiClient {
  chat: ChatService
  constructor() {
    this.chat = new ChatService()
  }
}

export const api = new ApiClient()

// Optional Step 11: Example for future endpoints (commented out for now)
// class AiService {
//   async getRecommendations(sessionId: string) {
//     const res = await fetch(
//       `${import.meta.env.VITE_API_BASE_URL}/ai/recommendations?sessionId=${sessionId}`
//     )
//     if (!res.ok) throw new Error('Failed to fetch AI recommendations')
//     return res.json()
//   }
// }