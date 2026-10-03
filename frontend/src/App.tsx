import { useEffect, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import TailoredResumeWorkspace from './components/workspace/TailoredResumeWorkspace'
import type { User } from './types/auth'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState<boolean>(() => {
    return Boolean(
      localStorage.getItem('careerTrack_token') ||
      sessionStorage.getItem('careerTrack_token')
    )
  })

  useEffect(() => {
    const token =
      localStorage.getItem('careerTrack_token') ||
      sessionStorage.getItem('careerTrack_token')

    if (!token) {
      return
    }

    // Verify existing token on startup
    fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.ok) {
          return res.json()
        }
        throw new Error('Token expired or invalid')
      })
      .then((userData: User) => {
        setUser(userData)
      })
      .catch(() => {
        localStorage.removeItem('careerTrack_token')
        sessionStorage.removeItem('careerTrack_token')
      })
      .finally(() => {
        setInitializing(false)
      })
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('careerTrack_token')
    sessionStorage.removeItem('careerTrack_token')
    setUser(null)
  }

  if (initializing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div className="brand-badge">
          <span className="pulse-dot"></span>
          <span>Loading CareerTrack...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)}
      />
    )
  }

  // Authenticated State View - Tailored Resume Workspace
  return <TailoredResumeWorkspace user={user} onLogout={handleLogout} />
}
