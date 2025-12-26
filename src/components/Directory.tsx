import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import type { CustomerStatus } from '../lib/hooks'
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { FamilyDetailPanel } from './FamilyDetailPanel'
import { AddFamilyModal } from './AddFamilyModal'

// Define Student locally with all required fields from database
interface Student {
  id: string
  family_id: string
  full_name: string
  dob: string | null
  grade_level: string | null
  age_group: string | null
  homeschool_status: string | null
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// Define FamilyWithStudents locally with all required fields
interface FamilyWithStudents {
  id: string
  display_name: string
  status: CustomerStatus
  primary_email: string | null
  primary_phone: string | null
  primary_contact_name: string | null
  payment_gateway: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  last_contact_at: string | null
  reengagement_flag: boolean
  legacy_lookup_key: string | null
  notes: string | null
  created_at: string
  updated_at: string
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

// Custom hook for paginated families with students
function usePaginatedFamilies(page: number, pageSize: number, statusFilter: CustomerStatus | 'all') {
  return useQuery({
    queryKey: ['families', 'paginated', { page, pageSize, status: statusFilter }],
    queryFn: async () => {
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

      const { data, error, count } = await query

      if (error) throw error
      return { 
        families: (data || []) as FamilyWithStudents[], 
        totalCount: count || 0 
      }
    },
  })
}

// Hook to fetch a single family by ID (for external selection)
function useFamilyById(id: string | null) {
  return useQuery({
    queryKey: queryKeys.families.detail(id || 'none'),
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('families')
        .select(`*, students (*)`)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as FamilyWithStudents
    },
    enabled: !!id,
  })
}

export function Directory({ selectedFamilyId, onSelectFamily }: DirectoryProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all')
  const [selectedFamily, setSelectedFamily] = useState<FamilyWithStudents | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Modal state
  const [showAddFamily, setShowAddFamily] = useState(false)

  // Fetch paginated families
  const { data, isLoading, error } = usePaginatedFamilies(page, pageSize, statusFilter)
  const families = data?.families || []

  // Fetch family by ID when selected externally (from CommandPalette)
  const { data: externalFamily } = useFamilyById(
    selectedFamilyId && !families.find(f => f.id === selectedFamilyId) 
      ? selectedFamilyId 
      : null
  )

  // Handle external selection (from CommandPalette)
  useEffect(() => {
    if (selectedFamilyId && families.length > 0) {
      const family = families.find(f => f.id === selectedFamilyId)
      if (family) {
        setSelectedFamily(family)
      } else if (externalFamily) {
        setSelectedFamily(externalFamily)
      }
    }
  }, [selectedFamilyId, families, externalFamily])

  // Client-side search filtering
  const filteredFamilies = useMemo(() => {
    if (!searchQuery) return families
    const query = searchQuery.toLowerCase()
    return families.filter(family => 
      family.display_name.toLowerCase().includes(query) ||
      family.primary_email?.toLowerCase().includes(query) ||
      family.primary_phone?.includes(query) ||
      family.students.some(s => s.full_name.toLowerCase().includes(query))
    )
  }, [families, searchQuery])

  const handleSelectFamily = (family: FamilyWithStudents | null) => {
    setSelectedFamily(family)
    onSelectFamily?.(family?.id || null)
  }

  const handleClosePanel = () => {
    setSelectedFamily(null)
    onSelectFamily?.(null)
  }

  const handleFamilyUpdated = () => {
    // Invalidate queries to refetch data
    queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    // Refetch selected family if needed
    if (selectedFamily) {
      queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(selectedFamily.id) })
    }
  }

  // Reset page when filter changes
  const handleStatusFilterChange = (newStatus: CustomerStatus | 'all') => {
    setStatusFilter(newStatus)
    setPage(1)
  }

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
              onChange={(e) => handleStatusFilterChange(e.target.value as CustomerStatus | 'all')}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="paused">Paused</option>
              <option value="lead">Lead</option>
              <option value="churned">Churned</option>
            </select>

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
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-400">
              {error instanceof Error ? error.message : 'Failed to load families'}
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
          family={selectedFamily as any}
          onClose={handleClosePanel}
          onFamilyUpdated={handleFamilyUpdated}
        />
      )}

      {/* Add Family Modal */}
      <AddFamilyModal
        isOpen={showAddFamily}
        onClose={() => setShowAddFamily(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
        }}
      />
    </div>
  )
}