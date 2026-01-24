import { Loader2, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalFooterProps {
  /** Called when Cancel button is clicked */
  onCancel: () => void
  /** Called when Submit button is clicked. If provided, button uses type="button" with onClick instead of type="submit" */
  onSubmit?: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Additional disabled condition for submit button (combined with isSubmitting) */
  submitDisabled?: boolean
  /** Text shown on submit button when not loading */
  submitText?: string
  /** Text shown on submit button when loading */
  loadingText?: string
  /** Submit button color variant */
  submitVariant?: 'primary' | 'danger' | 'success'
  /** Whether to show animated spinner icon when loading */
  showSpinner?: boolean
  /** Icon to show on submit button (when not loading) */
  submitIcon?: ReactNode
  /** Delete button configuration - if provided, shows delete button on left */
  deleteConfig?: {
    onDelete: () => void
    text?: string
    isDeleting?: boolean
  }
  /** Additional class names for the container */
  className?: string
}

/**
 * ModalFooter - Standardized footer for modal dialogs
 * Provides consistent Cancel/Submit button layout with optional delete button
 */
export function ModalFooter({
  onCancel,
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  submitText = 'Save',
  loadingText = 'Saving...',
  submitVariant = 'primary',
  showSpinner = false,
  submitIcon,
  deleteConfig,
  className = '',
}: ModalFooterProps) {
  const submitVariantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  }

  const hasDelete = !!deleteConfig

  return (
    <div
      className={`flex ${hasDelete ? 'justify-between' : 'justify-end'} items-center gap-2 pt-4 border-t border-zinc-700 ${className}`}
    >
      {/* Delete button (optional, left-aligned) */}
      {deleteConfig && (
        <button
          type="button"
          onClick={deleteConfig.onDelete}
          disabled={deleteConfig.isDeleting}
          className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          {deleteConfig.isDeleting ? 'Deleting...' : (deleteConfig.text || 'Delete')}
        </button>
      )}

      {/* Right-aligned actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type={onSubmit ? 'button' : 'submit'}
          onClick={onSubmit}
          disabled={isSubmitting || submitDisabled}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${submitVariantClasses[submitVariant]}`}
        >
          {isSubmitting ? (
            <>
              {showSpinner && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loadingText}
            </>
          ) : (
            <>
              {submitIcon}
              {submitText}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
