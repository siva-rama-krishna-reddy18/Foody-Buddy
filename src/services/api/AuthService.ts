import type { AuthResponse, LoginPayload, RegisterPayload } from '../../types/auth'

const API_BASE = import.meta.env?.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || '';
const USE_MOCK = (import.meta.env.VITE_USE_MOCK_AUTH ?? 'true') === 'true'

export class AuthService {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 500))
      if (payload.email === 'fail@example.com') {
        throw new Error('Invalid credentials')
      }
      return {
        token: 'mock-token-123',
        user: { id: 'u_1', email: payload.email, name: 'Mock User' }
      }
    }

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.text()) || 'Login failed')
    return res.json()
  }

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 700))
      if (payload.email === 'exists@example.com') {
        throw new Error('Email already in use')
      }
      return {
        token: 'mock-token-456',
        user: { id: 'u_2', email: payload.email, name: payload.name }
      }
    }

    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.text()) || 'Registration failed')
    return res.json()
  }

  // Optional profile endpoint (for Week 2)
  async me(token: string): Promise<AuthResponse['user']> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 300))
      return { id: 'u_1', email: 'mock@user.com', name: 'Mock User' }
    }
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Failed to fetch profile')
    return res.json()
  }
}