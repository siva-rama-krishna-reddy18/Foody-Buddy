import MessageList from './MessageList'
import MessageInput from './MessageInput'

export default function ChatContainer() {
  return (
    <div className="flex flex-col h-full border rounded-lg shadow-lg">
      <div className="flex-1 overflow-y-auto">
        <MessageList />
      </div>
      <div className="p-2 border-t">
        <MessageInput />
      </div>
    </div>
  )
}