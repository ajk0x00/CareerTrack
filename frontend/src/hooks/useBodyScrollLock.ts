import { useEffect } from 'react'

let activeLocksCount = 0
let originalOverflow = ''
let originalPaddingRight = ''

/**
 * Custom hook to lock body scrolling when a modal or dialog is open,
 * preventing scroll chaining and background page movement.
 *
 * Uses a reference counter to support stacked or sequentially opened modals
 * and compensates for scrollbar width to prevent layout shifts.
 *
 * @param isLocked Whether the body scroll should currently be locked.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return

    if (activeLocksCount === 0) {
      // 1. Calculate scrollbar width before locking to avoid layout jump
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      originalOverflow = document.body.style.overflow
      originalPaddingRight = document.body.style.paddingRight

      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
    }

    activeLocksCount += 1

    return () => {
      activeLocksCount = Math.max(0, activeLocksCount - 1)

      if (activeLocksCount === 0) {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [isLocked])
}

export default useBodyScrollLock
