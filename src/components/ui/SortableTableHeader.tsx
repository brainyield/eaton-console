import { useState, type KeyboardEvent } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export type SortDirection = 'asc' | 'desc'

interface SortableTableHeaderProps {
  label: string
  field: string
  currentSort: { field: string; direction: SortDirection }
  onSort: (field: string) => void
  className?: string
}

/**
 * Accessible sortable table header that supports keyboard navigation.
 * Renders as a button inside a th element for proper semantics.
 */
export function SortableTableHeader({
  label,
  field,
  currentSort,
  onSort,
  className = '',
}: SortableTableHeaderProps) {
  const isActive = currentSort.field === field
  const direction = isActive ? currentSort.direction : null

  const handleClick = () => {
    onSort(field)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSort(field)
    }
  }

  // Determine aria-sort value
  let ariaSort: 'ascending' | 'descending' | 'none' = 'none'
  if (isActive) {
    ariaSort = direction === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider ${className}`}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 hover:text-zinc-200 focus:outline-none focus:text-zinc-200 focus:underline"
        aria-label={`Sort by ${label}, currently ${isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'not sorted'}`}
      >
        {label}
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">
          {direction === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </button>
    </th>
  )
}

/**
 * Hook to manage sort state for tables
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSortState<T extends string>(initialField: T, initialDirection: SortDirection = 'asc') {
  const [sort, setSort] = useState({ field: initialField, direction: initialDirection })

  const handleSort = (field: T) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return { sort, handleSort, setSort }
}
