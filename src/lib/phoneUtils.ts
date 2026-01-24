/**
 * Phone Number Utilities
 * Handles normalization, validation, and formatting of US phone numbers
 */

/**
 * Normalizes phone number to E.164 format (+1XXXXXXXXXX)
 * Accepts various input formats:
 * - (555) 123-4567
 * - 555-123-4567
 * - 555.123.4567
 * - 5551234567
 * - +15551234567
 * - 1-555-123-4567
 *
 * Returns null if invalid
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null

  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // Handle different formats
  let digits = cleaned
  if (digits.startsWith('+1')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.slice(1)
  } else if (digits.startsWith('+')) {
    return null // Non-US number, not supported
  }

  // Validate 10-digit US number
  if (digits.length !== 10) return null
  if (!/^[2-9]\d{9}$/.test(digits)) return null // Must start with 2-9

  return `+1${digits}`
}

/**
 * Formats phone for display
 * +15551234567 -> (555) 123-4567
 * Returns original if can't normalize
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '-'

  const normalized = normalizePhone(phone)
  if (!normalized) return phone // Return original if can't normalize

  const digits = normalized.slice(2) // Remove +1
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Validates phone number format
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  return normalizePhone(phone) !== null
}

/**
 * Gets the last 4 digits of a phone number for display
 * Useful for privacy-conscious displays
 */
export function getPhoneLast4(phone: string | null | undefined): string {
  if (!phone) return '****'

  const normalized = normalizePhone(phone)
  if (!normalized) return '****'

  return normalized.slice(-4)
}
