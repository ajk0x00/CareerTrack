import { createContext, useContext } from 'react'
import type { User } from '../types/auth'

export interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: User, rememberMe?: boolean) => void
  logout: () => void
  updateUser: (updatedUser: User) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
