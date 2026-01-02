import { useEffect, useState, useCallback, useRef } from 'react'
import { Command } from 'cmdk'
import { Search, Users, GraduationCap, UserCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Types for Supabase query results
interface FamilyResult {
  id: string
  display_name: string
  primary_email: string | null
  status: string
}

interface StudentResult {
  id: string
  full_name: string
  grade_level: string | null
  family_id: string
  family: { display_name: string } | null
}

interface TeacherResult {
  id: string
  display_name: string
  role: string | null
  status: string
}

interface SearchResult {
  id: string
  type: 'family' | 'student' | 'teacher'
  name: string
  subtitle?: string
  familyId?: string
}

interface CommandPaletteProps {
  onSelect: (result: SearchResult) => void
}

export function CommandPalette({ onSelect }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // Track request IDs to prevent stale results from overwriting newer ones
  const requestIdRef = useRef(0)

  // Toggle with ⌘K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Close on Escape - only add listener when modal is open
  useEffect(() => {
    if (!open) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open])

  // Search across tables with request cancellation to prevent stale results
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    // Increment request ID to track this specific request
    const currentRequestId = ++requestIdRef.current

    setLoading(true)
    const searchTerm = `%${searchQuery}%`

    try {
      // Search families
      const { data: familiesData } = await supabase
        .from('families')
        .select('id, display_name, primary_email, status')
        .or(`display_name.ilike.${searchTerm},primary_email.ilike.${searchTerm}`)
        .limit(5)

      // Check if this request is still the latest before continuing
      if (currentRequestId !== requestIdRef.current) return

      const families = (familiesData || []) as FamilyResult[]

      // Search students - include family_id for navigation
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, full_name, grade_level, family_id, family:families(display_name)')
        .ilike('full_name', searchTerm)
        .limit(5)

      // Check again before continuing
      if (currentRequestId !== requestIdRef.current) return

      const students = (studentsData || []) as StudentResult[]

      // Search teachers
      const { data: teachersData } = await supabase
        .from('teachers')
        .select('id, display_name, role, status')
        .or(`display_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
        .limit(5)

      // Final check before updating state
      if (currentRequestId !== requestIdRef.current) return

      const teachers = (teachersData || []) as TeacherResult[]

      const combined: SearchResult[] = [
        ...families.map((f) => ({
          id: f.id,
          type: 'family' as const,
          name: f.display_name,
          subtitle: f.primary_email || f.status,
        })),
        ...students.map((s) => ({
          id: s.id,
          type: 'student' as const,
          name: s.full_name,
          subtitle: s.grade_level
            ? `${s.grade_level} • ${s.family?.display_name || ''}`
            : s.family?.display_name || '',
          familyId: s.family_id,
        })),
        ...teachers.map((t) => ({
          id: t.id,
          type: 'teacher' as const,
          name: t.display_name,
          subtitle: t.role || t.status,
        })),
      ]

      // Only update results if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setResults(combined)
      }
    } catch (error) {
      // Only log error if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        console.error('Search error:', error)
      }
    } finally {
      // Only clear loading if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, search])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    setResults([])
    onSelect(result)
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'family':
        return <Users className="w-4 h-4 text-zinc-400" aria-hidden="true" />
      case 'student':
        return <GraduationCap className="w-4 h-4 text-zinc-400" aria-hidden="true" />
      case 'teacher':
        return <UserCircle className="w-4 h-4 text-zinc-400" aria-hidden="true" />
    }
  }

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'family':
        return 'Families'
      case 'student':
        return 'Students'
      case 'teacher':
        return 'Teachers'
    }
  }

  // Group results by type
  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {})

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      
      {/* Command Palette */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl">
        <Command
          className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
          shouldFilter={false}
        >
          {/* Search Input */}
          <div className="flex items-center border-b border-zinc-700 px-4">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" aria-hidden="true" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search families, students, teachers..."
              className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 py-4 px-3 text-base outline-none"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 hover:bg-zinc-800 rounded"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              </button>
            )}
            <kbd className="ml-2 px-2 py-1 text-xs text-zinc-500 bg-zinc-800 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {loading && (
              <div className="py-6 text-center text-zinc-500 text-sm">
                Searching...
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="py-6 text-center text-zinc-500 text-sm">
                No results found for "{query}"
              </div>
            )}

            {!loading && !query && (
              <div className="py-6 text-center text-zinc-500 text-sm">
                Start typing to search...
              </div>
            )}

            {!loading && Object.entries(groupedResults).map(([type, items]) => (
              <Command.Group 
                key={type} 
                heading={getTypeLabel(type as SearchResult['type'])}
                className="mb-2"
              >
                <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {getTypeLabel(type as SearchResult['type'])}
                </div>
                {items.map((result) => (
                  <Command.Item
                    key={`${result.type}-${result.id}`}
                    value={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100"
                  >
                    {getIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.name}</div>
                      {result.subtitle && (
                        <div className="text-sm text-zinc-500 truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer */}
          <div className="border-t border-zinc-700 px-4 py-2.5 flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">esc</kbd>
              close
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}