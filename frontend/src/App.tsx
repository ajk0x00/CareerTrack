import { useEffect, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import Dashboard from './components/Dashboard'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
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

  // Authenticated State View
  return (
    <>
      <Navbar
        rightActions={
          <button
            type="button"
            className="header-btn"
            onClick={handleLogout}
            style={{ color: 'var(--error)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              logout
            </span>
            <span>Sign Out</span>
          </button>
        }
      />
      <Dashboard user={user} onLogout={handleLogout} />
      <Footer />
    </>
  )
}
