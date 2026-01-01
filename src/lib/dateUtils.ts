/**
 * Centralized date utilities for consistent date handling across the app.
 *
 * KEY PRINCIPLES:
 * 1. Use formatDateLocal() instead of toISOString().split('T')[0] to avoid timezone shifts
 * 2. Use parseLocalDate() to parse YYYY-MM-DD strings as local dates (not UTC)
 * 3. Always normalize to midnight with dateAtMidnight() before comparing dates
 * 4. Use daysBetween() for consistent day difference calculations
 */

/**
 * Format a Date as YYYY-MM-DD in local time.
 *
 * IMPORTANT: Never use date.toISOString().split('T')[0] as it converts to UTC first,
 * causing dates to shift one day earlier in timezones west of UTC (EST, CST, PST, etc.)
 *
 * @example
 * // In EST timezone at 11pm on Jan 15:
 * new Date().toISOString().split('T')[0]  // "2024-01-16" (WRONG - shifted to UTC)
 * formatDateLocal(new Date())              // "2024-01-15" (CORRECT - local date)
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string as a local date (midnight in local timezone).
 *
 * IMPORTANT: Never use new Date(dateStr) for YYYY-MM-DD strings as the behavior
 * is inconsistent across browsers and can parse as UTC, causing timezone issues.
 *
 * @example
 * new Date('2024-01-15')           // Parsed as UTC midnight (inconsistent)
 * parseLocalDate('2024-01-15')     // Local midnight on Jan 15 (consistent)
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Normalize a date to local midnight for consistent comparisons.
 *
 * Use this before comparing dates to avoid time-of-day affecting the result.
 *
 * @example
 * const today = dateAtMidnight(new Date())
 * const dueDate = dateAtMidnight(parseLocalDate(invoice.due_date))
 * if (dueDate < today) { // Overdue }
 */
export function dateAtMidnight(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Calculate the number of whole days between two dates.
 *
 * Uses midnight normalization and Math.round() for consistent results
 * that aren't affected by DST transitions or time-of-day differences.
 *
 * @returns Positive if date2 is after date1, negative if before
 *
 * @example
 * daysBetween(parseLocalDate('2024-01-01'), parseLocalDate('2024-01-15'))  // 14
 * daysBetween(new Date(), parseLocalDate(invoice.due_date))  // Days until due (or negative if overdue)
 */
export function daysBetween(date1: Date, date2: Date): number {
  const d1 = dateAtMidnight(date1)
  const d2 = dateAtMidnight(date2)
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  return Math.round((d2.getTime() - d1.getTime()) / MS_PER_DAY)
}

/**
 * Get today's date as a YYYY-MM-DD string in local time.
 *
 * @example
 * const today = getTodayString()  // "2024-01-15"
 */
export function getTodayString(): string {
  return formatDateLocal(new Date())
}

/**
 * Check if a date string represents today.
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayString()
}

/**
 * Check if a date string is in the past (before today).
 */
export function isPast(dateStr: string): boolean {
  const date = parseLocalDate(dateStr)
  const today = dateAtMidnight(new Date())
  return dateAtMidnight(date) < today
}

/**
 * Check if a date string is in the future (after today).
 */
export function isFuture(dateStr: string): boolean {
  const date = parseLocalDate(dateStr)
  const today = dateAtMidnight(new Date())
  return dateAtMidnight(date) > today
}

/**
 * Parse a YYYY-MM-DD string as UTC midnight for database operations.
 *
 * Use this when you need explicit UTC handling for API/database timestamps.
 */
export function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z')
}

/**
 * Add days to a date and return a new Date object.
 *
 * Handles DST transitions correctly by working with dates at noon.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Get the start of the week (Monday) for a given date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the end of the week (Sunday) for a given date.
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date)
  return addDays(start, 6)
}
