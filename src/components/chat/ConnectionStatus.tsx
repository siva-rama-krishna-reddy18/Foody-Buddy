import { useChatStore } from '../../stores/useChatStore'

export default function ConnectionStatus() {
  const connected = useChatStore((state) => state.connected)

  return (
    <div className="flex items-center text-sm space-x-2">
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          connected ? 'bg-green-500' : 'bg-red-500'
        }`}
      ></span>
      <span className={connected ? 'text-green-500' : 'text-red-500'}>
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  )
}