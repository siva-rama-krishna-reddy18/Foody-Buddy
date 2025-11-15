export interface ChatMessage {
  text: string;
  sender: 'me' | 'other';
  type?: 'welcome' | 'normal';
  quickActions?: { label: string; value: string }[];
}