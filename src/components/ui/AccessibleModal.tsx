import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { FocusTrap } from 'focus-trap-react'
import { X } from 'lucide-react'

interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** ID for aria-describedby - will be applied to a description element you should provide */
  descriptionId?: string
  /** Set to true to show a close button in the header */
  showCloseButton?: boolean
  /** Set to false to prevent closing on backdrop click */
  closeOnBackdropClick?: boolean
  /** Set to false to prevent closing on Escape key */
  closeOnEscape?: boolean
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'lg',
  descriptionId,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: AccessibleModalProps) {
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current
  const triggerRef = useRef<Element | null>(null)

  // Store the element that triggered the modal
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
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose()
      }
    },
    [closeOnBackdropClick, onClose]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
      />

      {/* Modal container with click handler */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            allowOutsideClick: true,
            escapeDeactivates: false, // We handle Escape ourselves
            returnFocusOnDeactivate: false, // We handle return focus ourselves
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={`bg-zinc-900 border border-zinc-700 rounded-lg w-full ${SIZE_CLASSES[size]} max-h-[90vh] overflow-y-auto shadow-xl`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-zinc-100">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-zinc-400">{subtitle}</p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Content */}
            {children}
          </div>
        </FocusTrap>
      </div>
    </div>
  )
}

/**
 * A simpler modal for confirmations/alerts with a different layout
 */
interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}

const VARIANT_STYLES = {
  danger: 'bg-red-600 hover:bg-red-700',
  warning: 'bg-amber-600 hover:bg-amber-700',
  info: 'bg-blue-600 hover:bg-blue-700',
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmationModalProps) {
  const descriptionId = useRef(`modal-desc-${Math.random().toString(36).slice(2)}`).current

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            allowOutsideClick: true,
            escapeDeactivates: false,
            returnFocusOnDeactivate: true,
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={descriptionId}
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full shadow-xl"
          >
            <h2 id="confirm-title" className="text-lg font-semibold text-white mb-2">
              {title}
            </h2>
            <p id={descriptionId} className="text-sm text-zinc-400 mb-6">
              {description}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                disabled={isLoading}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-white rounded transition-colors disabled:opacity-50 ${VARIANT_STYLES[variant]}`}
              >
                {isLoading ? 'Loading...' : confirmLabel}
              </button>
            </div>
          </div>
        </FocusTrap>
      </div>
    </div>
  )
}
