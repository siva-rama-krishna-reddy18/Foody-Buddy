import { useEffect } from 'react'
import ChatContainer from '../components/chat/ChatContainer'
import ConnectionStatus from '../components/chat/ConnectionStatus'
import { useChatStore } from '../stores/useChatStore'
import { useAuthStore } from '../stores/useAuthStore'

export default function Chat() {
  const connectSocket = useChatStore((s) => s.connectSocket)
  const disconnectSocket = useChatStore((s) => s.disconnectSocket)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    connectSocket()
    return () => disconnectSocket()
  }, [connectSocket, disconnectSocket])

  return (
    <div className="h-screen flex flex-col items-center gap-3 p-3">
      <div className="w-full max-w-2xl flex items-center justify-between">
        <div className="text-sm text-gray-600 truncate">
          Signed in as <span className="font-medium">{user?.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus />
          <button
            onClick={logout}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="w-full max-w-2xl grow">
        <ChatContainer />
      </div>
    </div>
  )
}