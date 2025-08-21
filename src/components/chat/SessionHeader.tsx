// src/components/chat/SessionHeader.tsx
import { useState } from 'react'
import { useChatStore } from '../../stores/useChatStore'

export default function SessionHeader() {
  const { currentSession } = useChatStore()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(currentSession?.title || 'Chat Session')

  const handleSave = () => {
    // You can implement rename functionality here later
    setIsEditing(false)
  }

  const handleCancel = () => {
    setTitle(currentSession?.title || 'Chat Session')
    setIsEditing(false)
  }

  return (
    <div className="border-b p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        {isEditing ? (
          <div className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
            >
              Rename
            </button>
          </>
        )}
      </div>
      
      {/* Optional: Show session info */}
      {currentSession && (
        <div className="mt-2 text-xs text-gray-500">
          Session ID: {currentSession.id}
        </div>
      )}
    </div>
  )
}