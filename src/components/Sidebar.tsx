import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Receipt,
  GraduationCap,
  BarChart3,
  Settings,
  Search,
  ChevronDown,
  CalendarDays,
  Wallet,
  Train
} from 'lucide-react'

interface NavItem {
  name: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}

const navigation: NavItem[] = [
  { name: 'Command Center', icon: LayoutDashboard, href: '/' },
  { name: 'Directory', icon: Users, href: '/directory' },
  { name: 'Active Roster', icon: ClipboardList, href: '/roster' },
  { name: 'Events', icon: CalendarDays, href: '/events' },
  { name: 'Invoicing', icon: Receipt, href: '/invoicing' },
  { name: 'Payroll', icon: Wallet, href: '/payroll' },
  { name: 'Teachers', icon: GraduationCap, href: '/teachers' },
  { name: 'Reports', icon: BarChart3, href: '/reports' },
  { name: 'Settings', icon: Settings, href: '/settings' },
]

interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
}

export function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  const [recentFamilies] = useState([
    { name: 'Paz, LaDonna', href: '/directory/1' },
    { name: 'Smith, Johnson', href: '/directory/2' },
    { name: 'Garcia, Maria', href: '/directory/3' },
  ])

  const openCommandPalette = () => {
    // Dispatch the keyboard event that CommandPalette listens for
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }

  return (
    <div className="flex h-full w-56 flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-zinc-800">
        <Train className="w-5 h-5 text-blue-400" />
        <span className="text-lg font-semibold text-white">NON-STOP TRAIN</span>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <button 
          className="flex w-full items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-auto text-xs bg-zinc-700 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navigation.map((item) => {
          const isActive = currentPath === item.href || 
            (item.href !== '/' && currentPath.startsWith(item.href))
          
          return (
            <button
              key={item.name}
              onClick={() => onNavigate(item.href)}
              className={`
                flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium
                ${isActive 
                  ? 'bg-zinc-800 text-white' 
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }
              `}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </button>
          )
        })}
      </nav>

      {/* Recent */}
      <div className="px-3 py-4 border-t border-zinc-800">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-medium text-zinc-500 uppercase">Recent</span>
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        </div>
        <div className="space-y-1">
          {recentFamilies.map((family) => (
            <button
              key={family.name}
              onClick={() => onNavigate(family.href)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              {family.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}