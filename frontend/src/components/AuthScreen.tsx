import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ApiError, TokenResponse, User } from '../types/auth'
import { useAuth } from '../context/AuthContext'
import AlertBanner from './AlertBanner'
import AuthShowcase from './AuthShowcase'
import Footer from './Footer'
import InputField from './InputField'
import Navbar from './Navbar'
import SocialAuth from './SocialAuth'
import TrustBadges from './TrustBadges'

interface AuthScreenProps {
  onAuthSuccess?: (user: User, token: string) => void
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false)
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [rememberMe, setRememberMe] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      if (isRegisterMode) {
        // 1. Call Register endpoint
        const regRes = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        if (!regRes.ok) {
          const errData: ApiError = await regRes.json()
          const detail = typeof errData.detail === 'string'
            ? errData.detail
            : Array.isArray(errData.detail)
            ? errData.detail[0]?.msg
            : 'Registration failed'
          throw new Error(detail || 'Registration failed')
        }

        setSuccessMessage('Account registered successfully! Logging you in...')
      }

      // 2. Call Login endpoint
      const loginRes = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          remember_me: rememberMe,
        }),
      })

      if (!loginRes.ok) {
        const errData: ApiError = await loginRes.json()
        const detail = typeof errData.detail === 'string'
          ? errData.detail
          : Array.isArray(errData.detail)
          ? errData.detail[0]?.msg
          : 'Invalid email or password'
        throw new Error(detail || 'Authentication failed')
      }

      const tokenData: TokenResponse = await loginRes.json()

      if (rememberMe) {
        localStorage.setItem('careerTrack_token', tokenData.access_token)
        sessionStorage.removeItem('careerTrack_token')
      } else {
        sessionStorage.setItem('careerTrack_token', tokenData.access_token)
        localStorage.removeItem('careerTrack_token')
      }

      // 3. Fetch authenticated user profile
      const userRes = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      })

      if (userRes.ok) {
        const userData: User = await userRes.json()
        login(tokenData.access_token, userData, rememberMe)
        if (onAuthSuccess) {
          onAuthSuccess(userData, tokenData.access_token)
        }
        const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/'
        navigate(from, { replace: true })
      } else {
        throw new Error('Failed to retrieve user profile')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />

      <main className="main-wrapper">
        <div className="auth-page-container">
          <div className="auth-card">
            {/* Ambient Background Glows */}
            <div className="ambient-glow-1"></div>
            <div className="ambient-glow-2"></div>

            {/* LEFT COLUMN: Authentication Form */}
            <section className="auth-form-column">
              <div>
                {/* Brand Mini Badge */}
                <div className="brand-badge">
                  <span className="pulse-dot"></span>
                  <span>Career OS Authentication</span>
                </div>

                {/* Title & Subtitle */}
                <div className="auth-header">
                  <h1 className="auth-title">
                    {isRegisterMode ? 'Create your account' : 'Welcome back'}
                  </h1>
                  <p className="auth-subtitle">
                    {isRegisterMode
                      ? 'Start logging your career achievements, skills, and generate tailored ATS resumes.'
                      : 'Log in to access your continuous work log, verified achievements, and tailored resumes.'}
                  </p>
                </div>

                {/* Social Login Buttons */}
                <SocialAuth />

                {/* Divider */}
                <div className="auth-divider">
                  <div className="divider-line"></div>
                  <span className="divider-text">Or continue with email</span>
                </div>

                {/* Feedback Banners */}
                {errorMessage && <AlertBanner type="error" message={errorMessage} />}
                {successMessage && <AlertBanner type="success" message={successMessage} />}

                {/* Authentication Form */}
                <form className="auth-form" onSubmit={handleSubmit}>
                  <InputField
                    id="emailInput"
                    type="email"
                    required
                    label="Work or Personal Email"
                    icon="mail"
                    placeholder="alex.chen@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />

                  <InputField
                    id="passwordInput"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={isRegisterMode ? 8 : 1}
                    label="Password"
                    icon="lock"
                    placeholder={isRegisterMode ? 'At least 8 characters' : '••••••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    labelAction={
                      !isRegisterMode ? (
                        <a href="#forgot" className="forgot-link">
                          Forgot password?
                        </a>
                      ) : undefined
                    }
                    rightAccessory={
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    }
                  />

                  {/* Remember Me Option */}
                  {!isRegisterMode && (
                    <div className="form-options">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          className="checkbox-input"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span>Remember me for 30 days</span>
                      </label>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button type="submit" className="submit-btn" disabled={loading}>
                    <span>
                      {loading
                        ? isRegisterMode
                          ? 'Creating account...'
                          : 'Signing in...'
                        : isRegisterMode
                        ? 'Create CareerTrack Account'
                        : 'Sign in to CareerTrack'}
                    </span>
                    <span className="material-symbols-outlined btn-arrow-icon">arrow_forward</span>
                  </button>
                </form>

                {/* Switch between Sign in and Register */}
                <div className="switch-mode-wrapper">
                  <span>
                    {isRegisterMode
                      ? 'Already have a CareerTrack account?'
                      : "Don't have an account yet?"}
                  </span>
                  <button
                    type="button"
                    className="switch-mode-btn"
                    onClick={() => {
                      setIsRegisterMode(!isRegisterMode)
                      setErrorMessage(null)
                      setSuccessMessage(null)
                    }}
                  >
                    {isRegisterMode
                      ? 'Sign in instead'
                      : 'Create account (Free 14-day trial)'}
                  </button>
                </div>
              </div>

              {/* Security & Reliability Badges */}
              <TrustBadges />
            </section>

            {/* RIGHT COLUMN: Visual Showcase */}
            <AuthShowcase />
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
