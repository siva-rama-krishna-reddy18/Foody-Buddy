export interface ChatMessage {
  text: string;
  sender: 'me' | 'other';
  type?: 'welcome' | 'normal'; // 👈 add this optional property
}