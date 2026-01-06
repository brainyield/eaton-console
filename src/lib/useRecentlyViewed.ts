import { useState, useCallback } from 'react'

export interface RecentItem {
  id: string
  name: string
  type: 'family' | 'enrollment' | 'teacher'
  href: string
  timestamp: number
}

const STORAGE_KEY = 'recentlyViewed'
const MAX_ITEMS = 5

function getStoredItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (err) {
    // localStorage may be corrupted or unavailable - return empty list
    console.warn('Failed to read recently viewed items:', err)
    return []
  }
}

function saveItems(items: RecentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (err) {
    // localStorage might be full or unavailable - fail silently
    console.warn('Failed to save recently viewed items:', err)
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(getStoredItems)

  const addItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    setItems(current => {
      // Remove existing entry for this item (to move it to top)
      const filtered = current.filter(i => !(i.id === item.id && i.type === item.type))

      // Add new item at the beginning
      const newItems: RecentItem[] = [
        { ...item, timestamp: Date.now() },
        ...filtered
      ].slice(0, MAX_ITEMS)

      // Save to localStorage
      saveItems(newItems)

      return newItems
    })
  }, [])

  const clearItems = useCallback(() => {
    setItems([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { items, addItem, clearItems }
}

// Standalone function to add item (for use outside React components)
export function addRecentlyViewed(item: Omit<RecentItem, 'timestamp'>): void {
  const current = getStoredItems()
  const filtered = current.filter(i => !(i.id === item.id && i.type === item.type))
  const newItems: RecentItem[] = [
    { ...item, timestamp: Date.now() },
    ...filtered
  ].slice(0, MAX_ITEMS)
  saveItems(newItems)
}
