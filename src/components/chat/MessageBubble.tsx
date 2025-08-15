interface MessageBubbleProps {
  text: string
  sender: 'me' | 'other'
}

export default function MessageBubble({ text, sender }: MessageBubbleProps) {
  const isMe = sender === 'me'
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`px-4 py-2 rounded-lg max-w-xs ${
          isMe ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
        }`}
      >
        {text}
      </div>
    </div>
  )
}