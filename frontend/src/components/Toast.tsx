import React, { useState, useCallback, useMemo } from 'react'
import {
  ToastContext,
  type ToastItem,
} from './ToastContext'

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newToast: ToastItem = { id, type, title, message, duration }

      setToasts((prev) => [...prev, newToast])

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, duration)
      }
    },
    [removeToast]
  )

  const success = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'success', title: title || 'Success', message })
    },
    [showToast]
  )

  const error = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'error', title: title || 'Error', message })
    },
    [showToast]
  )

  const info = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'info', title: title || 'Note', message })
    },
    [showToast]
  )

  const warning = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'warning', title: title || 'Notice', message })
    },
    [showToast]
  )

  const contextValue = useMemo(
    () => ({
      showToast,
      success,
      error,
      info,
      warning,
      removeToast,
    }),
    [showToast, success, error, info, warning, removeToast]
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast-portal-container" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`toast-card toast-${item.type}`}
            role={item.type === 'error' ? 'alert' : 'status'}
          >
            <div className={`toast-icon-wrap ${item.type}`}>
              <span className="material-symbols-outlined toast-icon">
                {item.type === 'success' && 'check_circle'}
                {item.type === 'error' && 'error'}
                {item.type === 'warning' && 'warning'}
                {item.type === 'info' && 'info'}
              </span>
            </div>

            <div className="toast-content">
              {item.title && <div className="toast-title">{item.title}</div>}
              <div className="toast-message">{item.message}</div>
            </div>

            <button
              type="button"
              className="toast-dismiss-btn"
              onClick={() => removeToast(item.id)}
              aria-label="Dismiss notification"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                close
              </span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
