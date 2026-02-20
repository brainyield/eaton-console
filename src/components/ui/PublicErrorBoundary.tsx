import { Component, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  children: ReactNode
  pageName: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class PublicErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Supabase for debugging (table not yet in auto-generated types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from as any)('error_log')
      .insert({
        page: this.props.pageName,
        error_message: error.message,
        error_stack: error.stack?.slice(0, 2000) || null,
        component_stack: errorInfo.componentStack?.slice(0, 2000) || null,
        url: window.location.href,
        user_agent: navigator.userAgent,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ error: dbError }: { error: any }) => {
        if (dbError) console.error('Failed to log error:', dbError)
      })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="text-4xl mb-4">:(</div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-zinc-400 mb-6">
              We're sorry for the inconvenience. Please try refreshing the page.
              If the problem persists, contact us at{' '}
              <a
                href="mailto:info@eatonacademy.com"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                info@eatonacademy.com
              </a>
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
