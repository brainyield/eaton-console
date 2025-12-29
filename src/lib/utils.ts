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
