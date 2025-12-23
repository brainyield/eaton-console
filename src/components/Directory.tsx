import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Family, Student, CustomerStatus } from '../types/database'
import { Search, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { FamilyDetailPanel } from './FamilyDetailPanel'
import { AddFamilyModal } from './AddFamilyModal'

interface FamilyWithStudents extends Family {
  students: Student[]
  total_balance?: number
  active_enrollment_count?: number
}

interface DirectoryProps {
  selectedFamilyId?: string | null
  onSelectFamily?: (id: string | null) => void
}

const STATUS_COLORS: Record<CustomerStatus, string> = {
  active: 'bg-green-500/20 text-green-400',
  trial: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-amber-500/20 text-amber-400',
  churned: 'bg-red-500/20 text-red-400',
  lead: 'bg-gray-500/20 text-gray-400',
}

export function Directory({ selectedFamilyId, onSelectFamily }: DirectoryProps) {
  const [families, setFamilies] = useState<FamilyWithStudents[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all')
  const [selectedFamily, setSelectedFamily] = useState<FamilyWithStudents | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Modal state
  const [showAddFamily, setShowAddFamily] = useState(false)

  useEffect(() => {
    fetchFamilies()
  }, [page, statusFilter])

  // Handle external selection (from CommandPalette)
  useEffect(() => {
    if (selectedFamilyId && families.length > 0) {
      const family = families.find(f => f.id === selectedFamilyId)
      if (family) {
        setSelectedFamily(family)
      } else {
        // Family not in current page, fetch it directly
        fetchFamilyById(selectedFamilyId)
      }
    }
  }, [selectedFamilyId, families])

  async function fetchFamilyById(id: string) {
    const { data, error } = await supabase
      .from('families')
      .select(`*, students (*)`)
      .eq('id', id)
      .single()

    if (!error && data) {
      setSelectedFamily(data as FamilyWithStudents)
    }
  }

  async function fetchFamilies() {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('families')
        .select(`
          *,
          students (*)
        `, { count: 'exact' })
        .order('display_name')
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error: queryError } = await query

      if (queryError) throw queryError

      setFamilies(data as FamilyWithStudents[] || [])
    } catch (err) {
      console.error('Error fetching families:', err)
      setError(err instanceof Error ? err.message : 'Failed to load families')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectFamily = (family: FamilyWithStudents | null) => {
    setSelectedFamily(family)
    onSelectFamily?.(family?.id || null)
  }

  const handleClosePanel = () => {
    setSelectedFamily(null)
    onSelectFamily?.(null)
  }

  const handleFamilyUpdated = () => {
    // Refresh the list and re-fetch selected family if needed
    fetchFamilies()
    if (selectedFamily) {
      fetchFamilyById(selectedFamily.id)
    }
  }

  const filteredFamilies = families.filter(family => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      family.display_name.toLowerCase().includes(query) ||
      family.primary_email?.toLowerCase().includes(query) ||
      family.primary_phone?.includes(query) ||
      family.students.some(s => s.full_name.toLowerCase().includes(query))
    )
  })

  return (
    <div className="h-full flex">
      <div className={`flex-1 flex flex-col ${selectedFamily ? 'mr-[480px]' : ''}`}>
        <div className="px-6 py-4 border-b border-zinc-800">
          <h1 className="text-xl font-semibold text-white mb-4">Directory</h1>
          
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search families, students, emails, phones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | 'all')}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="paused">Paused</option>
              <option value="lead">Lead</option>
              <option value="churned">Churned</option>
            </select>

            <button className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-700">
              <Filter className="h-4 w-4" />
              Filters
            </button>

            <button 
              onClick={() => setShowAddFamily(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 rounded-md px-4 py-2 text-sm text-white font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Family
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-400">
              {error}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-900 sticky top-0">
                <tr className="border-b border-zinc-800">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="rounded bg-zinc-800 border-zinc-600" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Contact
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredFamilies.map((family) => (
                  <tr
                    key={family.id}
                    onClick={() => handleSelectFamily(family)}
                    className={`
                      hover:bg-zinc-800/50 cursor-pointer
                      ${selectedFamily?.id === family.id ? 'bg-zinc-800' : ''}
                    `}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded bg-zinc-800 border-zinc-600" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">{family.display_name}</div>
                      {family.primary_contact_name && (
                        <div className="text-xs text-zinc-500">{family.primary_contact_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {family.students.slice(0, 2).map((student) => (
                          <div key={student.id} className="text-sm text-zinc-300">
                            {student.full_name}
                            {student.grade_level && (
                              <span className="text-zinc-500 ml-1">({student.grade_level})</span>
                            )}
                          </div>
                        ))}
                        {family.students.length > 2 && (
                          <div className="text-xs text-zinc-500">
                            +{family.students.length - 2} more
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[family.status]}`}>
                        {family.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${(family.total_balance || 0) > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                        ${(family.total_balance || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-zinc-300">{family.primary_email}</div>
                      <div className="text-xs text-zinc-500">{family.primary_phone}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Showing {filteredFamilies.length} families
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-md bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-zinc-400">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={families.length < pageSize}
              className="p-2 rounded-md bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {selectedFamily && (
        <FamilyDetailPanel
          family={selectedFamily}
          onClose={handleClosePanel}
          onFamilyUpdated={handleFamilyUpdated}
        />
      )}

      {/* Add Family Modal */}
      <AddFamilyModal
        isOpen={showAddFamily}
        onClose={() => setShowAddFamily(false)}
        onSuccess={() => {
          fetchFamilies()
        }}
      />
    </div>
  )
}