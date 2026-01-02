import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { FocusTrap } from 'focus-trap-react'
import { X } from 'lucide-react'

interface AccessibleSlidePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Icon to display in the header */
  icon?: ReactNode
  /** Width of the panel */
  width?: 'md' | 'lg' | 'xl' | '2xl'
  /** Set to false to prevent closing on backdrop click */
  closeOnBackdropClick?: boolean
  /** Set to false to prevent closing on Escape key */
  closeOnEscape?: boolean
}

const WIDTH_CLASSES = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function AccessibleSlidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  icon,
  width = '2xl',
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: AccessibleSlidePanelProps) {
  const titleId = useRef(`panel-title-${Math.random().toString(36).slice(2)}`).current
  const triggerRef = useRef<Element | null>(null)

  // Store the element that triggered the panel
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement
    }
  }, [isOpen])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEscape, onClose])

  // Return focus to trigger element when closing
  useEffect(() => {
    if (!isOpen && triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus()
    }
  }, [isOpen])

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdropClick) {
      onClose()
    }
  }, [closeOnBackdropClick, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <FocusTrap
        focusTrapOptions={{
          initialFocus: false,
          allowOutsideClick: true,
          escapeDeactivates: false,
          returnFocusOnDeactivate: false,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`fixed right-0 top-0 h-full w-full ${WIDTH_CLASSES[width]} bg-zinc-900 border-l border-zinc-700 shadow-xl overflow-y-auto`}
        >
          {/* Header */}
          <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-6 py-4 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center" aria-hidden="true">
                    {icon}
                  </div>
                )}
                <div>
                  <h2 id={titleId} className="text-lg font-semibold text-white">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-sm text-zinc-400">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="Close panel"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Content */}
          {children}
        </div>
      </FocusTrap>
    </div>
  )
}
