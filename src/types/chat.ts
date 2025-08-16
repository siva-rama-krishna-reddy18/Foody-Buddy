export interface ChatMessage {
  text: string;
  sender: 'me' | 'other';
}