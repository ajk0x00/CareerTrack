import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { User } from '../types/auth'
import { AuthContext, type AuthContextValue } from './AuthContext'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() => {
    return (
      localStorage.getItem('careerTrack_token') ||
      sessionStorage.getItem('careerTrack_token') ||
      null
    )
  })
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token))

  useEffect(() => {
    const storedToken =
      localStorage.getItem('careerTrack_token') ||
      sessionStorage.getItem('careerTrack_token')

    if (!storedToken) {
      return
    }

    let isMounted = true

    fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${storedToken}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Token invalid or expired')
        return res.json()
      })
      .then((userData: User) => {
        if (isMounted) {
          setUser(userData)
          setToken(storedToken)
        }
      })
      .catch(() => {
        if (isMounted) {
          localStorage.removeItem('careerTrack_token')
          sessionStorage.removeItem('careerTrack_token')
          setUser(null)
          setToken(null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(
    (newToken: string, newUser: User, rememberMe = false) => {
      if (rememberMe) {
        localStorage.setItem('careerTrack_token', newToken)
        sessionStorage.removeItem('careerTrack_token')
      } else {
        sessionStorage.setItem('careerTrack_token', newToken)
        localStorage.removeItem('careerTrack_token')
      }
      setToken(newToken)
      setUser(newUser)
    },
    []
  )

  const logout = useCallback(() => {
    localStorage.removeItem('careerTrack_token')
    sessionStorage.removeItem('careerTrack_token')
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  const contextValue: AuthContextValue = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
      updateUser,
    }),
    [user, token, isLoading, login, logout, updateUser]
  )

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}
