import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthScreen from './components/AuthScreen'
import TailoredResumeWorkspace from './components/workspace/TailoredResumeWorkspace'
import JobPipeline from './components/workspace/JobPipeline'
import ProtectedRoute from './components/common/ProtectedRoute'
import PublicOnlyRoute from './components/common/PublicOnlyRoute'
import { AuthProvider } from './context'
import { ToastProvider } from './components/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public-only authentication route */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<AuthScreen />} />
            </Route>

            {/* Protected application routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<TailoredResumeWorkspace />} />
              <Route path="/workspace" element={<Navigate to="/" replace />} />
              <Route
                path="/experience"
                element={<TailoredResumeWorkspace initialModal="experience" />}
              />
              <Route
                path="/skills"
                element={<TailoredResumeWorkspace initialModal="skills" />}
              />
              <Route
                path="/settings"
                element={<TailoredResumeWorkspace initialModal="settings" />}
              />
              <Route
                path="/settings/:tab"
                element={<TailoredResumeWorkspace initialModal="settings" />}
              />
              <Route path="/pipeline" element={<JobPipeline />} />
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
