import { useState, useCallback } from 'react'

/**
 * Hook for managing multi-item selection state
 * Common pattern in Directory, Marketing, Invoicing, GenerateDraftsModal, etc.
 */
export function useMultiSelection<T extends { id: string }>(initialIds: string[] = []) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialIds))

  const toggleItem = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map(item => item.id)))
  }, [])

  const selectNone = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  const toggleAll = useCallback((items: T[]) => {
    if (selectedIds.size === items.length) {
      selectNone()
    } else {
      selectAll(items)
    }
  }, [selectedIds.size, selectAll, selectNone])

  return {
    selectedIds,
    setSelectedIds,
    toggleItem,
    selectAll,
    selectNone,
    toggleAll,
    isSelected,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    isAllSelected: useCallback((items: T[]) =>
      items.length > 0 && selectedIds.size === items.length, [selectedIds.size]),
  }
}

/**
 * Hook for managing single-item selection with optional detail panel
 * Common pattern in ActiveRoster, Events, Invoicing, etc.
 */
export function useSingleSelection<T extends { id: string } | null>() {
  const [selected, setSelected] = useState<T | null>(null)

  const select = useCallback((item: T | null) => {
    setSelected(item)
  }, [])

  const clear = useCallback(() => {
    setSelected(null)
  }, [])

  const isSelected = useCallback((id: string) => {
    return selected?.id === id
  }, [selected])

  return {
    selected,
    setSelected: select,
    clear,
    isSelected,
    hasSelection: selected !== null,
  }
}

/**
 * Hook for managing expandable/collapsible groups
 * Common pattern in ActiveRoster for grouping enrollments
 */
export function useExpandedGroups(initialExpanded: string[] = []) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(initialExpanded))

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }, [])

  const expandAll = useCallback((groupNames: string[]) => {
    setExpandedGroups(new Set(groupNames))
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set())
  }, [])

  const isExpanded = useCallback((groupName: string) => {
    return expandedGroups.has(groupName)
  }, [expandedGroups])

  return {
    expandedGroups,
    setExpandedGroups,
    toggleGroup,
    expandAll,
    collapseAll,
    isExpanded,
    expandedCount: expandedGroups.size,
  }
}
