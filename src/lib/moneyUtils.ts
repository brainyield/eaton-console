/**
 * Centralized money/currency utilities for consistent handling across the app.
 *
 * KEY PRINCIPLES:
 * 1. Always round after multiplication to avoid floating point errors
 * 2. When summing, either work in cents or round the final result
 * 3. Always use toFixed(2) for display
 * 4. Validate parsed numbers before calculations
 */

/**
 * Multiply two money values safely, avoiding floating point errors.
 *
 * @example
 * // BAD: 0.1 * 0.2 = 0.020000000000000004
 * // GOOD: multiplyMoney(0.1, 0.2) = 0.02
 *
 * multiplyMoney(10.5, 3)  // 31.50
 * multiplyMoney(hourlyRate, hours)  // Correctly rounded
 */
export function multiplyMoney(a: number, b: number): number {
  return Math.round(a * b * 100) / 100
}

/**
 * Add two money values safely.
 */
export function addMoney(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100
}

/**
 * Subtract money values safely.
 */
export function subtractMoney(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100
}

/**
 * Sum an array of money values safely.
 * Rounds the final result to avoid accumulated floating point errors.
 *
 * @example
 * sumMoney([10.1, 20.2, 30.3])  // 60.60 (not 60.599999...)
 */
export function sumMoney(values: number[]): number {
  const sum = values.reduce((acc, val) => acc + val, 0)
  return Math.round(sum * 100) / 100
}

/**
 * Convert cents to dollars safely.
 * Use this instead of dividing by 100 inline.
 */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100
}

/**
 * Convert dollars to cents safely.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Format a number as currency for display.
 * Always shows 2 decimal places.
 *
 * @example
 * formatCurrency(10)      // "$10.00"
 * formatCurrency(10.5)    // "$10.50"
 * formatCurrency(null)    // "$0.00"
 * formatCurrency(1234.56) // "$1,234.56"
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a number as currency without the dollar sign.
 * Useful for input fields or when you need just the number.
 *
 * @example
 * formatMoneyValue(10.5)  // "10.50"
 * formatMoneyValue(null)  // "0.00"
 */
export function formatMoneyValue(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '0.00'
  return amount.toFixed(2)
}

/**
 * Format a rate for display (e.g., hourly rate).
 *
 * @example
 * formatRate(65)      // "$65.00/hr"
 * formatRate(65, 'hr')   // "$65.00/hr"
 * formatRate(100, 'mo')  // "$100.00/mo"
 */
export function formatRate(amount: number | null | undefined, unit: string = 'hr'): string {
  if (amount == null || isNaN(amount)) return '-'
  return `$${amount.toFixed(2)}/${unit}`
}

/**
 * Parse a string to a money value safely.
 * Returns null if the string is not a valid positive number.
 *
 * @example
 * parseMoneyInput("10.50")  // 10.5
 * parseMoneyInput("abc")    // null
 * parseMoneyInput("")       // null
 * parseMoneyInput("-5")     // null (negative not allowed by default)
 */
export function parseMoneyInput(value: string, allowNegative: boolean = false): number | null {
  if (!value || value.trim() === '') return null

  // Remove currency symbols and commas
  const cleaned = value.replace(/[$,]/g, '').trim()
  const parsed = parseFloat(cleaned)

  if (isNaN(parsed)) return null
  if (!allowNegative && parsed < 0) return null

  return Math.round(parsed * 100) / 100
}

/**
 * Parse a string to a money value, with a fallback.
 * Use this when you need a guaranteed number (e.g., for calculations).
 *
 * @example
 * parseMoneyInputOrDefault("10.50", 0)  // 10.5
 * parseMoneyInputOrDefault("abc", 0)    // 0
 */
export function parseMoneyInputOrDefault(value: string, defaultValue: number = 0): number {
  const parsed = parseMoneyInput(value)
  return parsed ?? defaultValue
}

/**
 * Calculate percentage safely.
 *
 * @example
 * calculatePercentage(25, 100)  // 25
 * calculatePercentage(1, 3)     // 33.33
 */
export function calculatePercentage(part: number, total: number, decimals: number = 2): number {
  if (total === 0) return 0
  const percentage = (part / total) * 100
  const multiplier = Math.pow(10, decimals)
  return Math.round(percentage * multiplier) / multiplier
}

/**
 * Format a percentage for display.
 *
 * @example
 * formatPercentage(25)      // "25%"
 * formatPercentage(33.333)  // "33.3%"
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value == null || isNaN(value)) return '0%'
  return `${value.toFixed(decimals)}%`
}
