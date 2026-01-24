import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryClient'
import { getTodayString } from '../lib/dateUtils'
import {
  addRecentlyViewed,
  usePaginatedFamilies,
  calculateFamilyBalances,
  type CustomerStatus,
  type FamilyWithStudents,
  type DirectorySortField,
  type DirectorySortConfig,
} from '../lib/hooks'
import {
  Search, Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Download, Trash2, RefreshCw, X, Loader2
} from 'lucide-react'
import { FamilyDetailPanel } from './FamilyDetailPanel'
import { AddFamilyModal } from './AddFamilyModal'
import { calculateAge } from '../lib/utils'
import { CUSTOMER_STATUS_COLORS } from './ui/StatusBadge'

interface DirectoryProps {
  selectedFamilyId?: string | null
  onSelectFamily?: (id: string | null) => void
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

      // Use the shared calculateFamilyBalances helper
      const balanceMap = await calculateFamilyBalances([id])
      const total_balance = balanceMap.get(id) || 0

      return { ...data, total_balance } as FamilyWithStudents
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
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<DirectorySortConfig>({ field: 'display_name', direction: 'asc' })
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Bulk action states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Modal state
  const [showAddFamily, setShowAddFamily] = useState(false)

  // Debounced search query for API calls
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1) // Reset to page 1 when search changes
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch paginated families with search
  const { data, isLoading, error } = usePaginatedFamilies(page, pageSize, statusFilter, sortConfig, debouncedSearch)
  const families = data?.families || []
  const totalCount = data?.totalCount || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // Fetch family by ID when selected externally (from CommandPalette)
  const { data: externalFamily } = useFamilyById(
    selectedFamilyId && !families.find(f => f.id === selectedFamilyId) 
      ? selectedFamilyId 
      : null
  )

  // Bulk update status mutation
  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: CustomerStatus }) => {
      const { error } = await supabase
        .from('families')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] })
      setSelectedIds(new Set())
      setShowStatusDropdown(false)
    }
  })

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      // Check if any families have enrollments or invoices
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('family_id')
        .in('family_id', ids)
        .limit(1)

      if (enrollments && enrollments.length > 0) {
        throw new Error('Cannot delete families with enrollments. End enrollments first.')
      }

      const { data: invoices } = await supabase
        .from('invoices')
        .select('family_id')
        .in('family_id', ids)
        .limit(1)

      if (invoices && invoices.length > 0) {
        throw new Error('Cannot delete families with invoices.')
      }

      const { error } = await supabase
        .from('families')
        .delete()
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] })
      setSelectedIds(new Set())
    }
  })

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

  // Handle selection from sessionStorage (from Events page)
  useEffect(() => {
    const storedFamilyId = sessionStorage.getItem('selectedFamilyId')
    if (storedFamilyId) {
      sessionStorage.removeItem('selectedFamilyId')
      onSelectFamily?.(storedFamilyId)
    }
  }, [])


  const handleSelectFamily = (family: FamilyWithStudents | null) => {
    setSelectedFamily(family)
    onSelectFamily?.(family?.id || null)

    // Track recently viewed families
    if (family) {
      addRecentlyViewed({
        id: family.id,
        name: family.display_name,
        type: 'family',
        href: `/directory?family=${family.id}`
      })
    }
  }

  const handleClosePanel = () => {
    setSelectedFamily(null)
    onSelectFamily?.(null)
  }

  const handleFamilyUpdated = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
    if (selectedFamily) {
      queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(selectedFamily.id) })
    }
  }

  // Reset page when filter changes
  const handleStatusFilterChange = (newStatus: CustomerStatus | 'all') => {
    setStatusFilter(newStatus)
    setPage(1)
    setSelectedIds(new Set())
  }

  // Sort handler
  const handleSort = (field: DirectorySortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
    setPage(1)
  }

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(families.map(f => f.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(id)
    } else {
      newSet.delete(id)
    }
    setSelectedIds(newSet)
  }

  const isAllSelected = families.length > 0 && families.every(f => selectedIds.has(f.id))
  const isSomeSelected = selectedIds.size > 0

  // Export selected to CSV
  const handleExportCSV = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const selected = families.filter(f => selectedIds.has(f.id))
      const headers = ['Family Name', 'Status', 'Email', 'Phone', 'Students', 'Balance']
      const rows = selected.map(f => [
        f.display_name,
        f.status,
        f.primary_email || '',
        f.primary_phone || '',
        (f.students || []).map(s => s.full_name).join('; '),
        f.total_balance.toFixed(2)
      ])

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `families-export-${getTodayString()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  // Handle bulk status change
  const handleBulkStatusChange = (status: CustomerStatus) => {
    // Prevent duplicate submissions
    if (bulkUpdateStatus.isPending) return
    if (!confirm(`Change status of ${selectedIds.size} families to "${status}"?`)) return
    bulkUpdateStatus.mutate({ ids: Array.from(selectedIds), status })
  }

  // Handle bulk delete
  const handleBulkDelete = () => {
    // Prevent duplicate submissions
    if (bulkDelete.isPending) return
    if (!confirm(`Delete ${selectedIds.size} families? This cannot be undone.`)) return
    bulkDelete.mutate(Array.from(selectedIds))
  }

  // Render sort icon
  const SortIcon = ({ field }: { field: DirectorySortField }) => {
    if (sortConfig.field !== field) {
      return <ChevronUp className="h-3 w-3 text-zinc-600" aria-hidden="true" />
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-3 w-3 text-blue-400" aria-hidden="true" />
      : <ChevronDown className="h-3 w-3 text-blue-400" aria-hidden="true" />
  }

  return (
    <div className="h-full flex">
      <div className={`flex-1 flex flex-col transition-all duration-200 ${selectedFamily ? 'mr-[480px]' : ''}`}>
        <div className="px-6 py-4 border-b border-zinc-800">
          <h1 className="text-xl font-semibold text-white mb-4">Directory</h1>
          
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" aria-hidden="true" />
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
              <option value="churned">Churned</option>
            </select>

            <button
              onClick={() => setShowAddFamily(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 rounded-md px-4 py-2 text-sm text-white font-medium transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Family
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {isSomeSelected && (
          <div className="px-6 py-3 bg-blue-900/30 border-b border-blue-800/50 flex items-center gap-4">
            <span className="text-sm text-blue-300">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              {/* Change Status Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  disabled={bulkUpdateStatus.isPending}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkUpdateStatus.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Change Status
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-50">
                    {(['active', 'trial', 'paused', 'churned'] as CustomerStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => handleBulkStatusChange(status)}
                        disabled={bulkUpdateStatus.isPending}
                        className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-700 capitalize disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Export CSV */}
              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                Export CSV
              </button>

              {/* Delete */}
              <button
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600/80 hover:bg-red-600 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDelete.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Delete
              </button>

              {/* Clear Selection */}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Clear
              </button>
            </div>

            {bulkDelete.isError && (
              <span className="text-sm text-red-400">
                {bulkDelete.error instanceof Error ? bulkDelete.error.message : 'Delete failed'}
              </span>
            )}
          </div>
        )}

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
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500"
                      aria-label="Select all families"
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider"
                    aria-sort={sortConfig.field === 'display_name' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('display_name')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSort('display_name')
                        }
                      }}
                      className="flex items-center gap-1 hover:text-white focus:outline-none focus:text-white focus:underline"
                      aria-label={`Sort by family name, currently ${sortConfig.field === 'display_name' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'not sorted'}`}
                    >
                      Family
                      <SortIcon field="display_name" />
                    </button>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                    onClick={() => handleSort('students')}
                  >
                    <div className="flex items-center gap-1">
                      Students
                      <SortIcon field="students" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                    onClick={() => handleSort('total_balance')}
                  >
                    <div className="flex items-center gap-1">
                      Balance
                      <SortIcon field="total_balance" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white"
                    onClick={() => handleSort('primary_email')}
                  >
                    <div className="flex items-center gap-1">
                      Contact
                      <SortIcon field="primary_email" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {families.map((family) => (
                  <tr
                    key={family.id}
                    onClick={() => handleSelectFamily(family)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectFamily(family)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Select ${family.display_name}`}
                    className={`
                      hover:bg-zinc-800/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                      ${selectedFamily?.id === family.id ? 'bg-zinc-800' : ''}
                      ${selectedIds.has(family.id) ? 'bg-blue-900/20' : ''}
                    `}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(family.id)}
                        onChange={(e) => handleSelectOne(family.id, e.target.checked)}
                        className="rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500"
                        aria-label={`Select ${family.display_name}`}
                      />
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
                            {calculateAge(student.dob) !== null && (
                              <span className="text-zinc-500 ml-1">({calculateAge(student.dob)})</span>
                            )}
                          </div>
                        ))}
                        {family.students.length > 2 && (
                          <div className="text-xs text-zinc-500">
                            +{family.students.length - 2} more
                          </div>
                        )}
                        {family.students.length === 0 && (
                          <div className="text-xs text-zinc-500">No students</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CUSTOMER_STATUS_COLORS[family.status]}`}>
                        {family.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${family.total_balance > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                        ${family.total_balance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-zinc-300">{family.primary_email || '—'}</div>
                      <div className="text-xs text-zinc-500">{family.primary_phone || ''}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            {debouncedSearch ? (
              <>Found {totalCount} matching {totalCount === 1 ? 'family' : 'families'}</>
            ) : (
              <>Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} families</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-md bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="text-sm text-zinc-400">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-md bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
          queryClient.invalidateQueries({ queryKey: queryKeys.families.all })
        }}
      />

      {/* Click outside to close status dropdown */}
      {showStatusDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowStatusDropdown(false)} 
        />
      )}
    </div>
  )
}