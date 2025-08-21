// src/services/api/ApiClient.ts

class ChatService {
  async getHistory(sessionId: string) {
    console.log('Fetching chat history for session:', sessionId);
    await new Promise(r => setTimeout(r, 300));
    return [
      { text: `Welcome to chat session ${sessionId}!`, sender: 'other' as const },
      { text: 'Thanks, happy to be here.', sender: 'me' as const },
    ];
  }

  // Optional: API call to AI chat endpoint (uncomment when backend ready)
  
  async sendAIMessage(message: string) {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!res.ok) throw new Error('Failed to get AI response');
    return res.json();
  }
  
}

export class ApiClient {
  chat: ChatService;
  constructor() {
    this.chat = new ChatService();
  }
}

export const api = new ApiClient();