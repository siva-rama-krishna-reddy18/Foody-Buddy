// src/components/chat/SessionHeader.tsx
import { useState } from 'react'
import { api } from '@/services/api/ApiClient'

interface SessionHeaderProps {
  sessionId: string
  customerId: string
  initialTitle?: string
}

export default function SessionHeader({
  sessionId,
  customerId,
  initialTitle = 'Chat Session',
}: SessionHeaderProps) {
  const [title, setTitle] = useState(initialTitle)
  const [editing, setEditing] = useState(false)

  const handleSave = async () => {
    try {
      const updated = await api.chat.renameSession(sessionId, title, customerId)
      setTitle(updated.title)
    } catch (e: any) {
      console.error('Failed to rename session:', e)
    } finally {
      setEditing(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-2 border-b bg-gray-50">
      {editing ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          className="border rounded px-2 py-1 text-sm"
          autoFocus
        />
      ) : (
        <h2
          className="font-semibold text-gray-800 cursor-pointer"
          onClick={() => setEditing(true)}
        >
          {title}
        </h2>
      )}
    </div>
  )
}