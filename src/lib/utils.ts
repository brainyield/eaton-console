import { parseLocalDate } from './dateUtils'

/**
 * Formats a name to "Last Name, First Name" format.
 *
 * Rules:
 * - If the name already contains a comma, assume it's already formatted correctly
 * - If the name has no spaces (single name/nickname), leave it as-is
 * - If the name has multiple parts, treat the last word as the last name
 *   and everything before it as the first name(s)
 *
 * Examples:
 * - "John Smith" → "Smith, John"
 * - "Mary Jane Watson" → "Watson, Mary Jane"
 * - "Smith, John" → "Smith, John" (unchanged)
 * - "Noah" → "Noah" (unchanged)
 * - "Brussel Sprouts" → "Sprouts, Brussel" (will be formatted, user can manually fix nicknames)
 */
export function formatNameLastFirst(name: string | null | undefined): string {
  if (!name) return '';

  const trimmed = name.trim();

  // If empty after trimming, return empty
  if (!trimmed) return '';

  // If already contains a comma, assume it's already in "Last, First" format
  if (trimmed.includes(',')) {
    return trimmed;
  }

  // If no spaces, it's a single name - leave as-is
  if (!trimmed.includes(' ')) {
    return trimmed;
  }

  // Split by spaces and rearrange to "Last, First Middle..."
  const parts = trimmed.split(/\s+/);
  const lastName = parts.pop()!; // Last word is the last name
  const firstNames = parts.join(' '); // Everything else is first/middle names

  return `${lastName}, ${firstNames}`;
}

/**
 * Calculates age from a date of birth string.
 * Returns null if the DOB is not provided or invalid.
 *
 * @param dob - Date of birth in ISO format (YYYY-MM-DD)
 * @returns Age in years, or null if DOB is not available
 */
export function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;

  // Validate format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;

  // Parse as local date to avoid timezone issues
  const birthDate = parseLocalDate(dob);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}
