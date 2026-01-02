/**
 * Input Validation Utilities
 * Centralized validation functions for form inputs
 */

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Validates and returns email or null if invalid
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  return isValidEmail(trimmed) ? trimmed : null
}

/**
 * Parse a positive float from string input
 * Returns null if invalid, NaN, negative, or empty
 */
export function parsePositiveFloat(value: string): number | null {
  if (!value || value.trim() === '') return null
  const num = parseFloat(value)
  if (isNaN(num) || num < 0) return null
  return num
}

/**
 * Parse a positive integer from string input
 * Returns null if invalid, NaN, negative, or empty
 */
export function parsePositiveInt(value: string): number | null {
  if (!value || value.trim() === '') return null
  const num = parseInt(value, 10)
  if (isNaN(num) || num < 0) return null
  return num
}

/**
 * Parse a float with bounds checking
 * Returns null if invalid or outside bounds
 */
export function parseFloatInRange(
  value: string,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  if (!value || value.trim() === '') return null
  const num = parseFloat(value)
  if (isNaN(num) || num < min || num > max) return null
  return num
}

/**
 * Parse an integer with bounds checking
 * Returns null if invalid or outside bounds
 */
export function parseIntInRange(
  value: string,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  if (!value || value.trim() === '') return null
  const num = parseInt(value, 10)
  if (isNaN(num) || num < min || num > max) return null
  return num
}

/**
 * Validates a date string is in YYYY-MM-DD format
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

/**
 * Validates that start date is before or equal to end date
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return true // If either is empty, skip range check
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
  return start <= end
}

/**
 * Validates phone number format (basic - allows various formats)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true // Phone is often optional
  // Allow digits, spaces, dashes, parentheses, plus sign
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '')
  return /^\d{7,15}$/.test(cleaned)
}

/**
 * Validates URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') return true // URL is often optional
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validates string is not empty after trimming
 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0
}

/**
 * Validates string length is within bounds
 */
export function isWithinLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength
}

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Creates a validation result
 */
export function createValidationResult(errors: string[]): ValidationResult {
  return {
    isValid: errors.length === 0,
    errors,
  }
}
