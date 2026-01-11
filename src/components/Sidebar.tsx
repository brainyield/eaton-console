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
  Train,
  Megaphone
} from 'lucide-react'
import { useRecentlyViewed } from '../lib/hooks'

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
  { name: 'Marketing', icon: Megaphone, href: '/marketing' },
  { name: 'Invoicing', icon: Receipt, href: '/invoicing' },
  { name: 'Payroll', icon: Wallet, href: '/payroll' },
  { name: 'Teachers', icon: GraduationCap, href: '/teachers' },
  { name: 'Reports', icon: BarChart3, href: '/reports' },
  { name: 'Settings', icon: Settings, href: '/settings' },
]

interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
  onSelectFamily?: (id: string) => void
}

export function Sidebar({ currentPath, onNavigate, onSelectFamily }: SidebarProps) {
  const { items: recentItems } = useRecentlyViewed()

  const handleRecentClick = (item: typeof recentItems[0]) => {
    if (item.type === 'family' && onSelectFamily) {
      onNavigate('/directory')
      onSelectFamily(item.id)
    } else {
      onNavigate(item.href)
    }
  }

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
        <Train className="w-5 h-5 text-blue-400" aria-hidden="true" />
        <span className="text-lg font-semibold text-white">NON-STOP TRAIN</span>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <button
          className="flex w-full items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
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
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.name}
            </button>
          )
        })}
      </nav>

      {/* Recent */}
      <div className="px-3 py-4 border-t border-zinc-800">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-medium text-zinc-500 uppercase">Recent</span>
          <ChevronDown className="h-3 w-3 text-zinc-500" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          {recentItems.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-zinc-600">No recent items</p>
          ) : (
            recentItems.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleRecentClick(item)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {item.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}