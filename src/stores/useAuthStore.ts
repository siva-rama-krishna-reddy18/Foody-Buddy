import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api } from '../services/api/ApiClient'
import type { User } from '../types/auth'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  _hasHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  setHydrated: (val: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setHydrated: (val) => set({ _hasHydrated: val }),

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await api.auth.login({ email, password })
          set({ token: res.token, user: res.user })
          // Optional: keep a mirror for services that read localStorage
          localStorage.setItem('auth_token', res.token)
        } catch (e: any) {
          set({ error: e?.message || 'Login failed' })
          throw e
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await api.auth.register({ name, email, password })
          set({ token: res.token, user: res.user })
          localStorage.setItem('auth_token', res.token)
        } catch (e: any) {
          set({ error: e?.message || 'Registration failed' })
          throw e
        } finally {
          set({ isLoading: false })
        }
      },

      logout: () => {
    if (get().token) {
      console.log('Logging out user:', get().user?.email)
    }
    localStorage.removeItem('auth_token')
    set({ token: null, user: null })
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
      partialize: (s) => ({ token: s.token, user: s.user }) // store only essentials
    }
  )
)