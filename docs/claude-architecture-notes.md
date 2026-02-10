# Architecture Notes

## Payroll — Two Systems

| System | Period | Tables | Notes |
|--------|--------|--------|-------|
| Legacy manual | Sep-Dec 2025 | `teacher_payments` | Individual payment records |
| Batch payroll | Jan 2026+ | `payroll_run`, `payroll_line_item` | Grouped by pay period |

- No FK relationship between the two systems
- Reports showing total teacher compensation must query BOTH tables
- Mutations affecting either system should invalidate `queryKeys.reports.all`

## Revenue Records

- `revenue_records` tracks by `family_id`, `student_id`, `service_id` — no `enrollment_id` FK
- `location_id` added directly for location-based reporting
- For tables >1000 rows, use `.rpc()` with database functions (see `get_revenue_by_month`, `get_revenue_by_location`)

## Lead Conversion Flow

1. Leads are families with `status='lead'`, `lead_status` tracks pipeline stage
2. Related tables: `lead_activities`, `lead_follow_ups`, `lead_campaign_engagement` (all use `family_id`)
3. Conversion: set `status='active'`, `lead_status='converted'`, `converted_at=NOW()`
4. The deprecated `leads` table should NOT be referenced
5. `AddFamilyModal` checks for matching leads before creating new families
6. Proper flow: Marketing → find lead → "Convert to Customer" → add students/enrollments

### Duplicate Detection for Family Lookups

- Check both `primary_email` and `secondary_email`
- Fall back to name-based matching if email fails
- Use `find_or_create_family_for_purchase()` stored procedure for new integrations
- Logs matches to `family_merge_log`
- `usePotentialDuplicates()` hook for reviewing edge cases

## Enrollments ↔ Teacher Assignments

- Both have `hours_per_week` fields that must stay in sync
- `EditEnrollmentModal` handles this — any new edit flows must also sync both
- Active Roster and Teachers views display `teacher_assignments.hours_per_week`
- Invoicing uses `enrollments.hours_per_week`
