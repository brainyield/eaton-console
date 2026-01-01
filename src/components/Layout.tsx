import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
  currentPath: string
  onNavigate: (path: string) => void
  onSelectFamily?: (id: string) => void
}

export function Layout({ children, currentPath, onNavigate, onSelectFamily }: LayoutProps) {
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} onSelectFamily={onSelectFamily} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}