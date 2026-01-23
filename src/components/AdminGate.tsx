import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'

const STORAGE_KEY = 'eaton_admin_auth'
const AUTH_EXPIRY_DAYS = 30

interface StoredAuth {
  verified: boolean
  expiresAt: number
}

function getStoredAuth(): StoredAuth | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored) as StoredAuth
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function setStoredAuth(): void {
  const expiresAt = Date.now() + (AUTH_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ verified: true, expiresAt }))
}

// To logout/clear admin auth, call: localStorage.removeItem('eaton_admin_auth')

interface AdminGateProps {
  children: React.ReactNode
}

export default function AdminGate({ children }: AdminGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const auth = getStoredAuth()
    setIsAuthenticated(auth?.verified ?? false)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Small delay to prevent brute force and provide feedback
    setTimeout(() => {
      const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD

      if (!adminPassword) {
        // If no password is configured, allow access (dev mode)
        setStoredAuth()
        setIsAuthenticated(true)
        setIsLoading(false)
        return
      }

      if (password === adminPassword) {
        setStoredAuth()
        setIsAuthenticated(true)
      } else {
        setError('Incorrect password')
        setPassword('')
      }
      setIsLoading(false)
    }, 500)
  }

  // Still checking localStorage
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    )
  }

  // Not authenticated - show password prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-zinc-400" />
              </div>
            </div>

            <h1 className="text-xl font-semibold text-zinc-100 text-center mb-2">
              Eaton Console
            </h1>
            <p className="text-sm text-zinc-500 text-center mb-6">
              Enter password to continue
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-md transition-colors"
              >
                {isLoading ? 'Verifying...' : 'Continue'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated - render children
  return <>{children}</>
}
