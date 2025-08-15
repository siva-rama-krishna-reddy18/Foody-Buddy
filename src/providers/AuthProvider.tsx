import type { ReactNode } from 'react'
import { useAuthStore } from '../stores/useAuthStore'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((s) => s._hasHydrated)

  if (!hydrated) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-gray-600">Loading…</div>
      </div>
    )
  }

  return <>{children}</>
}