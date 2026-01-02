import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Check, AlertCircle, X, AlertTriangle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
  showWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Global toast function for use outside React components (e.g., in queryClient)
let globalShowToast: ((message: string, type?: ToastType) => void) | null = null

export function getGlobalToast() {
  return globalShowToast
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-600',
  }[toast.type]

  const Icon = {
    success: Check,
    error: AlertCircle,
    warning: AlertTriangle,
  }[toast.type]

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white ${bgColor}`}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm">{toast.message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const showError = useCallback((message: string) => showToast(message, 'error'), [showToast])
  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast])
  const showWarning = useCallback((message: string) => showToast(message, 'warning'), [showToast])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Set global toast function for use outside React
  useEffect(() => {
    globalShowToast = showToast
    return () => {
      globalShowToast = null
    }
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showWarning }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
