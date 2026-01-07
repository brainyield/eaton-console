import { parseLocalDate } from './dateUtils'

/**
 * Name suffixes that should not be treated as last names.
 * These are preserved after the last name in the formatted output.
 */
const NAME_SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'esq', 'esq.', 'phd', 'md', 'dds']

/**
 * Formats a name to "Last Name, First Name" format.
 *
 * Rules:
 * - If the name already contains a comma, assume it's already formatted correctly
 * - If the name ends with " Family", strip the suffix and return just the last name
 * - If the name has no spaces (single name/nickname), leave it as-is
 * - If the name has multiple parts, treat the last word as the last name
 *   and everything before it as the first name(s)
 * - Handles name suffixes (Jr., Sr., III, etc.) by preserving them after the last name
 *
 * Examples:
 * - "John Smith" → "Smith, John"
 * - "Mary Jane Watson" → "Watson, Mary Jane"
 * - "Smith, John" → "Smith, John" (unchanged)
 * - "Noah" → "Noah" (unchanged)
 * - "Smith Family" → "Smith" (strips " Family" suffix)
 * - "John Smith Jr." → "Smith, John Jr." (preserves name suffix)
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

  // Handle "XYZ Family" format - strip " Family" suffix
  if (trimmed.endsWith(' Family')) {
    return trimmed.slice(0, -7); // Remove " Family" (7 chars)
  }

  // If no spaces, it's a single name - leave as-is
  if (!trimmed.includes(' ')) {
    return trimmed;
  }

  // Split by spaces and rearrange to "Last, First Middle..."
  const parts = trimmed.split(/\s+/);

  // Check if the last part is a name suffix (Jr., Sr., III, etc.)
  let suffix = '';
  if (parts.length > 2 && NAME_SUFFIXES.includes(parts[parts.length - 1].toLowerCase())) {
    suffix = ' ' + parts.pop()!;
  }

  const lastName = parts.pop()!; // Last word is the last name
  const firstNames = parts.join(' '); // Everything else is first/middle names

  return `${lastName}, ${firstNames}${suffix}`;
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
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

/**
 * Age group options that match the ActiveRoster sort order.
 * These are the canonical values stored in the database.
 */
export const AGE_GROUP_OPTIONS = ['3-5', '6-8', '9-11', '12-14', '15-17'] as const;
export type AgeGroup = (typeof AGE_GROUP_OPTIONS)[number];

/**
 * Age group sort order - maps age group strings to numeric sort values.
 * Used for sorting students/enrollments by age group.
 */
export const AGE_GROUP_ORDER: Record<string, number> = {
  '3-5': 1,
  '6-8': 2,
  '9-11': 3,
  '12-14': 4,
  '15-17': 5,
};

/**
 * Get numeric sort value for an age group.
 * Returns 999 for unknown/null values to push them to the end.
 */
export function getAgeGroupSortValue(ageGroup: string | null | undefined): number {
  if (!ageGroup) return 999;
  return AGE_GROUP_ORDER[ageGroup] ?? 999;
}

/**
 * Determines the age group from a date of birth.
 * Returns the appropriate age range string based on the student's current age.
 *
 * @param dob - Date of birth in ISO format (YYYY-MM-DD)
 * @returns Age group string (e.g., '9-11'), or null if DOB is unavailable or age is out of range
 */
export function getAgeGroup(dob: string | null | undefined): AgeGroup | null {
  const age = calculateAge(dob);
  if (age === null) return null;

  if (age >= 3 && age <= 5) return '3-5';
  if (age >= 6 && age <= 8) return '6-8';
  if (age >= 9 && age <= 11) return '9-11';
  if (age >= 12 && age <= 14) return '12-14';
  if (age >= 15 && age <= 17) return '15-17';

  return null; // Age outside typical school range
}
