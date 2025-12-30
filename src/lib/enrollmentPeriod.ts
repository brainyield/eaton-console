import type { ServiceCode } from '../types/database'

export type { ServiceCode }

// Service codes that use semester format (Fall/Spring/Summer YYYY)
const SEMESTER_SERVICES: ServiceCode[] = ['learning_pod', 'elective_classes']

export type PeriodType = 'semester' | 'school_year'

export function getPeriodTypeForService(serviceCode: ServiceCode): PeriodType {
  if (SEMESTER_SERVICES.includes(serviceCode)) {
    return 'semester'
  }
  return 'school_year'
}

/**
 * Get the current period based on today's date and service type
 *
 * Semester logic:
 * - Fall = Aug 1 - Dec 31 → "Fall YYYY"
 * - Spring = Jan 1 - May 31 → "Spring YYYY"
 * - Summer = Jun 1 - Jul 31 → "Summer YYYY"
 *
 * School Year logic:
 * - Aug 1 - Jul 31 → "YYYY-YYYY" (e.g., Aug 2025 - Jul 2026 = "2025-2026")
 */
export function getCurrentPeriod(serviceCode: ServiceCode, date: Date = new Date()): string {
  const periodType = getPeriodTypeForService(serviceCode)
  const month = date.getMonth() // 0-indexed (0 = Jan, 7 = Aug)
  const year = date.getFullYear()

  if (periodType === 'semester') {
    if (month >= 7 && month <= 11) {
      // Aug (7) - Dec (11) = Fall
      return `Fall ${year}`
    } else if (month >= 0 && month <= 4) {
      // Jan (0) - May (4) = Spring
      return `Spring ${year}`
    } else {
      // Jun (5) - Jul (6) = Summer
      return `Summer ${year}`
    }
  } else {
    // School year: Aug-Jul spans two calendar years
    if (month >= 7) {
      // Aug-Dec: we're in the first part of the school year
      return `${year}-${year + 1}`
    } else {
      // Jan-Jul: we're in the second part of the school year
      return `${year - 1}-${year}`
    }
  }
}

/**
 * Generate dropdown options for enrollment period based on service type
 * Returns current period + 2 future + 1 past
 */
export function getPeriodOptions(serviceCode: ServiceCode, date: Date = new Date()): string[] {
  const periodType = getPeriodTypeForService(serviceCode)
  const month = date.getMonth()
  const year = date.getFullYear()
  const options: string[] = []

  if (periodType === 'semester') {
    // Determine current semester
    let currentSemester: 'fall' | 'spring' | 'summer'
    let currentYear = year

    if (month >= 7 && month <= 11) {
      currentSemester = 'fall'
    } else if (month >= 0 && month <= 4) {
      currentSemester = 'spring'
    } else {
      currentSemester = 'summer'
    }

    // Build sequence of semesters
    const semesterSequence: { semester: string; year: number }[] = []

    // Start with 1 semester before current
    const allSemesters = ['spring', 'summer', 'fall'] as const
    const currentIndex = allSemesters.indexOf(currentSemester)

    // Go back 1 semester
    let idx = currentIndex - 1
    let y = currentYear
    if (idx < 0) {
      idx = 2 // wrap to fall
      y -= 1
    }
    semesterSequence.push({ semester: allSemesters[idx], year: y })

    // Add current
    semesterSequence.push({ semester: currentSemester, year: currentYear })

    // Add 3 future semesters
    idx = currentIndex
    y = currentYear
    for (let i = 0; i < 3; i++) {
      idx += 1
      if (idx > 2) {
        idx = 0 // wrap to spring
        y += 1
      }
      semesterSequence.push({ semester: allSemesters[idx], year: y })
    }

    // Format as "Season YYYY"
    for (const s of semesterSequence) {
      const seasonLabel = s.semester.charAt(0).toUpperCase() + s.semester.slice(1)
      options.push(`${seasonLabel} ${s.year}`)
    }
  } else {
    // School year format
    // Determine current school year
    let startYear: number
    if (month >= 7) {
      startYear = year
    } else {
      startYear = year - 1
    }

    // 1 past, current, 2 future
    for (let i = -1; i <= 2; i++) {
      const sy = startYear + i
      options.push(`${sy}-${sy + 1}`)
    }
  }

  return options
}

/**
 * Get the default period for a new enrollment based on service type
 */
export function getDefaultPeriod(serviceCode: ServiceCode): string {
  return getCurrentPeriod(serviceCode)
}
