import type { ReactNode } from 'react'

// =============================================================================
// FamilyItemGroup Component
// =============================================================================
// A reusable component for rendering grouped items (enrollments, orders, sessions)
// with a family header and list of child items.

export interface FamilyItemGroupProps {
  /** Unique identifier for the group */
  familyId: string
  /** Display name for the family */
  familyName: string
  /** Whether all items in this group are selected */
  allSelected: boolean
  /** Whether this group has a warning state (e.g., existing invoice, unlinked) */
  hasWarning?: boolean
  /** Warning message to display in the header */
  warningMessage?: string
  /** Whether the family-level checkbox is disabled */
  disabled?: boolean
  /** Total amount for the group */
  totalAmount?: number
  /** Handler for toggling the family selection */
  onToggleFamily: (familyId: string) => void
  /** Child items to render */
  children: ReactNode
  /** Additional CSS class for the container */
  className?: string
}

/**
 * FamilyItemGroup - A reusable container for grouped items with a selectable header.
 *
 * Used in GenerateDraftsModal for:
 * - Enrollment groups (weekly/monthly invoicing)
 * - Event order groups (Step Up events)
 * - Hub session groups (Calendly bookings)
 *
 * @example
 * ```tsx
 * <FamilyItemGroup
 *   familyId="123"
 *   familyName="Smith Family"
 *   allSelected={true}
 *   hasWarning={false}
 *   totalAmount={250.00}
 *   onToggleFamily={(id) => handleToggle(id)}
 * >
 *   {items.map(item => (
 *     <FamilyItemRow key={item.id} ... />
 *   ))}
 * </FamilyItemGroup>
 * ```
 */
export function FamilyItemGroup({
  familyId,
  familyName,
  allSelected,
  hasWarning = false,
  warningMessage,
  disabled = false,
  totalAmount,
  onToggleFamily,
  children,
  className = '',
}: FamilyItemGroupProps) {
  // Determine container styling based on warning state
  const containerClasses = hasWarning
    ? 'border-amber-500/30 bg-amber-500/5'
    : 'border-zinc-700 bg-zinc-800/30'

  const handleClick = () => {
    if (!disabled) {
      onToggleFamily(familyId)
    }
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${containerClasses} ${className}`}>
      {/* Family Header */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 cursor-pointer"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onToggleFamily(familyId)}
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
          />
          <span className="font-medium text-white">{familyName}</span>
          {warningMessage && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              {warningMessage}
            </span>
          )}
        </div>
        {totalAmount !== undefined && (
          <span className="text-sm text-zinc-400">
            ${totalAmount.toFixed(2)}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-zinc-800">
        {children}
      </div>
    </div>
  )
}

// =============================================================================
// FamilyItemRow Component
// =============================================================================
// A generic row component for items within a FamilyItemGroup.

export interface FamilyItemRowProps {
  /** Whether this item is selected */
  selected: boolean
  /** Whether this item is disabled */
  disabled?: boolean
  /** Whether this item has a dimmed/disabled appearance */
  dimmed?: boolean
  /** Handler for toggling the item selection */
  onToggle: () => void
  /** Main content of the row (left side) */
  children: ReactNode
  /** Right-side content (typically amount/actions) */
  rightContent?: ReactNode
  /** Additional CSS class for the row */
  className?: string
}

/**
 * FamilyItemRow - A single row within a FamilyItemGroup.
 *
 * @example
 * ```tsx
 * <FamilyItemRow
 *   selected={isSelected}
 *   disabled={hasExisting}
 *   dimmed={hasExisting}
 *   onToggle={() => handleToggle(item.id)}
 *   rightContent={<span>${amount}</span>}
 * >
 *   <ServiceBadge code={service.code} />
 *   <span>{student.full_name}</span>
 * </FamilyItemRow>
 * ```
 */
export function FamilyItemRow({
  selected,
  disabled = false,
  dimmed = false,
  onToggle,
  children,
  rightContent,
  className = '',
}: FamilyItemRowProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2 ${
        dimmed ? 'opacity-50' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={disabled}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50"
        />
        {children}
      </div>
      {rightContent && (
        <div className="text-right flex items-center gap-2">
          {rightContent}
        </div>
      )}
    </div>
  )
}
