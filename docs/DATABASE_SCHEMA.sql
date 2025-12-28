-- ============================================================================
-- EATON ACADEMIC CUSTOMER OPERATIONS CONSOLE
-- Database Schema for Supabase (PostgreSQL)
-- Version: 4.3 | Last Updated: 2024-12-28
-- ============================================================================
-- CHANGELOG v4.3:
-- - Fixed family_overview VIEW (Cartesian product bug causing inflated balances)
-- - Added reminder_14_day email template
-- - Fixed encoding issues in service descriptions
-- - Added RLS documentation note
--
-- CHANGELOG v4.2:
-- - Added service_id column to teacher_assignments for service-level assignments
-- - Made enrollment_id nullable (assignments can be to service OR enrollment)
-- - Added CHECK constraint: enrollment_id OR service_id must be set
-- - Added index on teacher_assignments.service_id
-- 
-- CHANGELOG v4.1:
-- - Consolidated 'consulting_with_teacher' and 'consulting_only' into single 'consulting' service
-- - Teacher assignment is now optional for consulting (requires_teacher = false)
-- - Deprecated services marked is_active = false (not deleted for history)
-- 
-- CHANGELOG v4.0:
-- - Added service types: eaton_hub, elective_classes
-- - Expanded teachers table: role, skillset, preferred_comm, status, payment_info_on_file
-- - Added hub_sessions table for drop-in day tracking
-- - Added teacher_payments and teacher_payment_line_items for payroll tracking
-- - Added class_title field to enrollments for elective classes
-- - Added employee_status enum, updated billing_frequency enum
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE customer_status AS ENUM ('lead', 'trial', 'active', 'paused', 'churned');
CREATE TYPE enrollment_status AS ENUM ('trial', 'active', 'paused', 'ended');
CREATE TYPE employee_status AS ENUM ('active', 'reserve', 'inactive');
CREATE TYPE billing_frequency AS ENUM ('per_session', 'weekly', 'monthly', 'bi_monthly', 'annual', 'one_time');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'partial', 'overdue', 'void');
CREATE TYPE comm_channel AS ENUM ('email', 'sms', 'call', 'in_person', 'other');
CREATE TYPE comm_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE workflow_status AS ENUM ('queued', 'running', 'success', 'error');

-- ============================================================================
-- REFERENCE TABLES
-- ============================================================================

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  billing_frequency billing_frequency NOT NULL DEFAULT 'monthly',
  default_customer_rate numeric(10,2),
  default_teacher_rate numeric(10,2),
  requires_teacher boolean NOT NULL DEFAULT true,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Active services (6 total)
INSERT INTO services (code, name, billing_frequency, default_customer_rate, requires_teacher, description) VALUES
  ('learning_pod', 'Learning Pod', 'monthly', NULL, true, 'Group learning pod sessions - monthly tuition varies'),
  ('academic_coaching', 'Academic Coaching', 'weekly', NULL, true, 'One-on-one academic coaching, billed weekly by hours'),
  ('consulting', 'Consulting', 'monthly', NULL, false, 'Monthly consulting services. Teacher assignment optional.'),
  ('eaton_online', 'Eaton Online', 'weekly', NULL, true, 'Online program, weekly tuition x weeks billed'),
  ('eaton_hub', 'Eaton Hub', 'per_session', 100.00, true, 'Drop-in learning hub - $100/day per student'),
  ('elective_classes', 'Elective Classes (Fridays at Eaton)', 'monthly', NULL, true, 'Monthly elective classes - Bitcoin, Adulting 101, etc.');

-- Deprecated services (kept for historical reference, is_active = false)
-- These were consolidated into 'consulting' in v4.1:
--   'consulting_with_teacher' -> 'consulting'
--   'consulting_only' -> 'consulting'

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#6B7280',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tags (name, color) VALUES
  ('Missing Forms', '#EF4444'),
  ('VIP', '#F59E0B'),
  ('StepUp Pending', '#3B82F6'),
  ('Payment Issue', '#EF4444'),
  ('New This Year', '#10B981');

-- ============================================================================
-- CORE CRM TABLES
-- ============================================================================

CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  status customer_status NOT NULL DEFAULT 'lead',
  primary_email text,
  primary_phone text,
  primary_contact_name text,
  payment_gateway text,
  address_line1 text,
  address_line2 text,
  city text,
  state text DEFAULT 'FL',
  zip text,
  last_contact_at timestamptz,
  reengagement_flag boolean NOT NULL DEFAULT false,
  notes text,
  legacy_lookup_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX families_email_uniq ON families (LOWER(primary_email)) WHERE primary_email IS NOT NULL;
CREATE INDEX families_status_idx ON families(status);
CREATE INDEX families_last_contact_idx ON families(last_contact_at);
CREATE INDEX families_payment_gateway_idx ON families(payment_gateway);
CREATE INDEX families_name_trgm ON families USING gin (display_name gin_trgm_ops);
CREATE INDEX families_email_trgm ON families USING gin (primary_email gin_trgm_ops);

CREATE TABLE family_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX family_contacts_family_idx ON family_contacts(family_id);
CREATE INDEX family_contacts_email_idx ON family_contacts(LOWER(email));

CREATE TABLE family_tags (
  family_id uuid REFERENCES families(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, tag_id)
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  dob date,
  grade_level text,
  age_group text,
  homeschool_status text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX students_family_idx ON students(family_id);
CREATE INDEX students_active_idx ON students(active);
CREATE INDEX students_name_trgm ON students USING gin (full_name gin_trgm_ops);

-- ============================================================================
-- EMPLOYEE/TEACHER TABLES
-- ============================================================================

CREATE TABLE teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email text,
  phone text,
  role text,
  skillset text,
  preferred_comm_method text,
  status employee_status NOT NULL DEFAULT 'active',
  default_hourly_rate numeric(10,2),
  max_hours_per_week numeric(6,2),
  payment_info_on_file boolean NOT NULL DEFAULT false,
  hire_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX teachers_name_uniq ON teachers(LOWER(display_name));
CREATE INDEX teachers_status_idx ON teachers(status);
CREATE INDEX teachers_role_idx ON teachers(role);

-- ============================================================================
-- ENROLLMENT & ASSIGNMENT TABLES
-- ============================================================================

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  status enrollment_status NOT NULL DEFAULT 'trial',
  start_date date,
  end_date date,
  annual_fee numeric(10,2),
  monthly_rate numeric(10,2),
  weekly_tuition numeric(10,2),
  hourly_rate_customer numeric(10,2),
  hours_per_week numeric(6,2),
  daily_rate numeric(10,2) DEFAULT 100.00,
  billing_frequency billing_frequency,
  curriculum text,
  program_type text,
  class_title text,
  schedule_notes text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX enrollments_family_idx ON enrollments(family_id);
CREATE INDEX enrollments_student_idx ON enrollments(student_id);
CREATE INDEX enrollments_service_idx ON enrollments(service_id);
CREATE INDEX enrollments_status_idx ON enrollments(status);
CREATE INDEX enrollments_class_title_idx ON enrollments(class_title) WHERE class_title IS NOT NULL;

-- Teacher assignments can be linked to either:
-- 1. An enrollment (for student-specific assignments like Academic Coaching)
-- 2. A service (for service-level assignments like Learning Pod, Elective Classes)
-- At least one of enrollment_id or service_id must be set.

CREATE TABLE teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  hourly_rate_teacher numeric(10,2),
  hours_per_week numeric(6,2),
  is_active boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_assignments_must_have_target 
    CHECK (enrollment_id IS NOT NULL OR service_id IS NOT NULL)
);

CREATE INDEX teacher_assignments_enrollment_idx ON teacher_assignments(enrollment_id);
CREATE INDEX teacher_assignments_service_idx ON teacher_assignments(service_id);
CREATE INDEX teacher_assignments_teacher_idx ON teacher_assignments(teacher_id);
CREATE INDEX teacher_assignments_active_idx ON teacher_assignments(is_active);

CREATE TABLE teacher_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_assignment_id uuid NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  agreed_hours numeric(6,2),
  hours_worked numeric(6,2),
  hour_adjustments numeric(6,2) DEFAULT 0,
  invoice_line_item_id uuid,
  teacher_payment_line_item_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_hours_assignment_idx ON teacher_hours(teacher_assignment_id);
CREATE INDEX teacher_hours_week_idx ON teacher_hours(week_start);

-- ============================================================================
-- EATON HUB SESSIONS (Drop-in tracking)
-- ============================================================================

CREATE TABLE hub_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  daily_rate numeric(10,2) NOT NULL DEFAULT 100.00,
  invoice_line_item_id uuid,
  teacher_id uuid REFERENCES teachers(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hub_sessions_student_idx ON hub_sessions(student_id);
CREATE INDEX hub_sessions_date_idx ON hub_sessions(session_date);
CREATE INDEX hub_sessions_unbilled_idx ON hub_sessions(invoice_line_item_id) WHERE invoice_line_item_id IS NULL;

-- ============================================================================
-- INVOICING TABLES
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_public_id() RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invoice_number text,
  public_id text UNIQUE DEFAULT generate_public_id(),
  invoice_date date NOT NULL,
  due_date date,
  period_start date,
  period_end date,
  subtotal numeric(10,2),
  total_amount numeric(10,2),
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  balance_due numeric(10,2) GENERATED ALWAYS AS (COALESCE(total_amount, 0) - COALESCE(amount_paid, 0)) STORED,
  status invoice_status NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  sent_to text,
  viewed_at timestamptz,
  pdf_storage_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_family_idx ON invoices(family_id);
CREATE INDEX invoices_status_idx ON invoices(status);
CREATE INDEX invoices_date_idx ON invoices(invoice_date);
CREATE INDEX invoices_due_date_idx ON invoices(due_date);
CREATE INDEX invoices_public_id_idx ON invoices(public_id);

CREATE TABLE invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollments(id),
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2),
  amount numeric(10,2),
  teacher_cost numeric(10,2),
  profit numeric(10,2),
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_line_items_invoice_idx ON invoice_line_items(invoice_id);
CREATE INDEX invoice_line_items_enrollment_idx ON invoice_line_items(enrollment_id);

ALTER TABLE teacher_hours 
  ADD CONSTRAINT teacher_hours_line_item_fk 
  FOREIGN KEY (invoice_line_item_id) REFERENCES invoice_line_items(id);

ALTER TABLE hub_sessions 
  ADD CONSTRAINT hub_sessions_line_item_fk 
  FOREIGN KEY (invoice_line_item_id) REFERENCES invoice_line_items(id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_invoice_idx ON payments(invoice_id);
CREATE INDEX payments_date_idx ON payments(payment_date);

CREATE TABLE invoice_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  sent_to text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  subject text,
  opened_at timestamptz,
  clicked_at timestamptz,
  workflow_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_emails_invoice_idx ON invoice_emails(invoice_id);
CREATE INDEX invoice_emails_type_idx ON invoice_emails(email_type);

-- ============================================================================
-- TEACHER PAYROLL TABLES
-- ============================================================================

CREATE TABLE teacher_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  pay_date date NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  payment_method text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_payments_teacher_idx ON teacher_payments(teacher_id);
CREATE INDEX teacher_payments_date_idx ON teacher_payments(pay_date);
CREATE INDEX teacher_payments_period_idx ON teacher_payments(pay_period_start, pay_period_end);

CREATE TABLE teacher_payment_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_payment_id uuid NOT NULL REFERENCES teacher_payments(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id),
  enrollment_id uuid REFERENCES enrollments(id),
  description text NOT NULL,
  hours numeric(6,2),
  hourly_rate numeric(10,2),
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX teacher_payment_line_items_payment_idx ON teacher_payment_line_items(teacher_payment_id);
CREATE INDEX teacher_payment_line_items_service_idx ON teacher_payment_line_items(service_id);

ALTER TABLE teacher_hours 
  ADD CONSTRAINT teacher_hours_payment_line_item_fk 
  FOREIGN KEY (teacher_payment_line_item_id) REFERENCES teacher_payment_line_items(id);

-- ============================================================================
-- EMAIL TEMPLATES
-- ============================================================================

CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO email_templates (template_key, name, subject, body_html, description) VALUES
('invoice', 'Invoice Email', 'Invoice {{invoice_number}} from Eaton Academic', 
'<p>Dear {{family_name}},</p>
<p>Please find your invoice below for services from {{period_start}} to {{period_end}}.</p>
<p><strong>Invoice #:</strong> {{invoice_number}}<br>
<strong>Amount Due:</strong> {{total_amount}}<br>
<strong>Due Date:</strong> {{due_date}}</p>
<p><a href="{{invoice_url}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Invoice</a></p>
<p>Payment can be made via Zelle, StepUp, or check.</p>
<p>Thank you,<br>Eaton Academic</p>',
'Variables: {{family_name}}, {{invoice_number}}, {{period_start}}, {{period_end}}, {{total_amount}}, {{due_date}}, {{invoice_url}}, {{balance_due}}'),

('reminder_7_day', 'Payment Reminder (7 Days)', 'Friendly Reminder: Invoice {{invoice_number}} Due Soon',
'<p>Dear {{family_name}},</p>
<p>This is a friendly reminder that invoice {{invoice_number}} for {{total_amount}} is due on {{due_date}}.</p>
<p><a href="{{invoice_url}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Invoice</a></p>
<p>If you have already sent payment, please disregard this notice.</p>
<p>Thank you,<br>Eaton Academic</p>',
'Variables: {{family_name}}, {{invoice_number}}, {{total_amount}}, {{due_date}}, {{invoice_url}}. Used for 1-13 days overdue.'),

('reminder_14_day', 'Payment Reminder (14 Days)', 'Payment Reminder: Invoice {{invoice_number}} is Past Due',
'<p>Dear {{family_name}},</p>
<p>Invoice {{invoice_number}} for {{balance_due}} was due on {{due_date}} and is now {{days_overdue}} days past due.</p>
<p>Please submit payment at your earliest convenience.</p>
<p><a href="{{invoice_url}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Invoice</a></p>
<p>If you have already sent payment, please disregard this notice.</p>
<p>Thank you,<br>Eaton Academic</p>',
'Variables: {{family_name}}, {{invoice_number}}, {{balance_due}}, {{due_date}}, {{days_overdue}}, {{invoice_url}}. Used for 14-29 days overdue.'),

('reminder_due', 'Payment Due Today', 'Payment Due Today - Invoice {{invoice_number}}',
'<p>Dear {{family_name}},</p>
<p>Invoice {{invoice_number}} for {{total_amount}} is due today.</p>
<p><a href="{{invoice_url}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View and Pay Invoice</a></p>
<p>Thank you,<br>Eaton Academic</p>',
'Variables: {{family_name}}, {{invoice_number}}, {{total_amount}}, {{invoice_url}}'),

('reminder_overdue', 'Payment Overdue (30+ Days)', 'Urgent: Invoice {{invoice_number}} is {{days_overdue}} Days Overdue',
'<p>Dear {{family_name}},</p>
<p>Invoice {{invoice_number}} for {{balance_due}} was due on {{due_date}} and is now {{days_overdue}} days overdue.</p>
<p>Please submit payment immediately to avoid any interruption in services.</p>
<p><a href="{{invoice_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Invoice</a></p>
<p>If you need to arrange a payment plan, please reply to this email.</p>
<p>Thank you,<br>Eaton Academic</p>',
'Variables: {{family_name}}, {{invoice_number}}, {{balance_due}}, {{due_date}}, {{days_overdue}}, {{invoice_url}}. Used for 30+ days overdue.'),

('payment_received', 'Payment Received', 'Thank You - Payment Received for Invoice {{invoice_number}}',
'<p>Dear {{family_name}},</p>
<p>We have received your payment of {{payment_amount}} for invoice {{invoice_number}}.</p>
<p>{{#if balance_due}}Your remaining balance is {{balance_due}}.{{else}}Your invoice is now paid in full.{{/if}}</p>
<p>Thank you for your prompt payment!</p>
<p>Eaton Academic</p>',
'Variables: {{family_name}}, {{invoice_number}}, {{payment_amount}}, {{balance_due}}');

-- ============================================================================
-- COMMUNICATIONS & WORKFLOW TABLES
-- ============================================================================

CREATE TABLE workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL,
  status workflow_status NOT NULL DEFAULT 'queued',
  payload jsonb,
  response jsonb,
  error_message text,
  triggered_by text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workflow_runs_key_idx ON workflow_runs(workflow_key);
CREATE INDEX workflow_runs_status_idx ON workflow_runs(status);
CREATE INDEX workflow_runs_created_idx ON workflow_runs(created_at);

CREATE TABLE communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  channel comm_channel NOT NULL,
  direction comm_direction NOT NULL,
  subject text,
  summary text,
  workflow_run_id uuid REFERENCES workflow_runs(id),
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX communications_family_idx ON communications(family_id);
CREATE INDEX communications_logged_idx ON communications(logged_at);

-- ============================================================================
-- SAVED VIEWS & SETTINGS
-- ============================================================================

CREATE TABLE saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL,
  filter_config jsonb NOT NULL,
  column_config jsonb,
  sort_config jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_views_entity_idx ON saved_views(entity_type);

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value, description) VALUES
('business_info', '{"name": "Eaton Academic", "email": "ivan@eatonacademic.com", "phone": "", "address": "Miami, FL"}', 'Business contact information'),
('invoice_defaults', '{"due_days": 15, "number_prefix": "INV-", "next_number": 1}', 'Invoice generation defaults'),
('payment_methods', '["StepUp", "Zelle", "Cash", "Check", "Stripe", "Bank Transfer"]', 'Accepted payment methods'),
('monthly_rates', '{"learning_pod": {"sep": 500, "oct": 500, "nov": 500, "dec": 100, "jan": 500, "feb": 500, "mar": 500, "apr": 500, "may": 250}, "elective_classes": {"default": 250}}', 'Monthly tuition rates by service'),
('hub_daily_rate', '100.00', 'Default daily rate for Eaton Hub drop-ins');

-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- Fixed in v4.3: Uses subqueries to avoid Cartesian product bug that was
-- multiplying balances when families had multiple students/enrollments/invoices
CREATE OR REPLACE VIEW family_overview AS
SELECT 
  f.id,
  f.display_name,
  f.status,
  f.primary_email,
  f.primary_phone,
  f.payment_gateway,
  f.last_contact_at,
  (SELECT COUNT(*) FROM students s WHERE s.family_id = f.id) AS student_count,
  (SELECT COUNT(*) FROM enrollments e WHERE e.family_id = f.id AND e.status = 'active') AS active_enrollment_count,
  (SELECT COALESCE(SUM(i.balance_due), 0) FROM invoices i WHERE i.family_id = f.id AND i.status IN ('sent', 'partial', 'overdue')) AS total_balance
FROM families f;

-- Updated view to handle both enrollment-level and service-level assignments
CREATE OR REPLACE VIEW teacher_load AS
SELECT 
  t.id,
  t.display_name,
  t.role,
  t.status,
  t.max_hours_per_week,
  COUNT(DISTINCT ta.id) FILTER (WHERE ta.is_active) AS active_assignments,
  COALESCE(SUM(ta.hours_per_week) FILTER (WHERE ta.is_active), 0) AS assigned_hours_per_week,
  t.max_hours_per_week - COALESCE(SUM(ta.hours_per_week) FILTER (WHERE ta.is_active), 0) AS available_hours
FROM teachers t
LEFT JOIN teacher_assignments ta ON ta.teacher_id = t.id
GROUP BY t.id;

CREATE OR REPLACE VIEW teacher_earnings_summary AS
SELECT 
  t.id,
  t.display_name,
  DATE_TRUNC('month', tp.pay_date) AS pay_month,
  COUNT(tp.id) AS payment_count,
  SUM(tp.total_amount) AS total_paid
FROM teachers t
LEFT JOIN teacher_payments tp ON tp.teacher_id = t.id
GROUP BY t.id, DATE_TRUNC('month', tp.pay_date);

CREATE OR REPLACE VIEW overdue_invoices AS
SELECT 
  i.*,
  f.display_name AS family_name,
  f.primary_email,
  f.primary_phone,
  f.last_contact_at,
  CURRENT_DATE - i.due_date AS days_overdue
FROM invoices i
JOIN families f ON i.family_id = f.id
WHERE i.status IN ('sent', 'partial')
  AND i.due_date < CURRENT_DATE
  AND i.balance_due > 0
ORDER BY days_overdue DESC;

CREATE OR REPLACE VIEW unbilled_hub_sessions AS
SELECT 
  hs.*,
  s.full_name AS student_name,
  f.display_name AS family_name,
  f.primary_email
FROM hub_sessions hs
JOIN students s ON hs.student_id = s.id
JOIN families f ON s.family_id = f.id
WHERE hs.invoice_line_item_id IS NULL
ORDER BY hs.session_date DESC;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total numeric;
  total_paid numeric;
BEGIN
  SELECT total_amount INTO invoice_total FROM invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM payments WHERE invoice_id = NEW.invoice_id;
  
  UPDATE invoices 
  SET 
    amount_paid = total_paid,
    status = CASE 
      WHEN total_paid >= invoice_total THEN 'paid'::invoice_status
      WHEN total_paid > 0 THEN 'partial'::invoice_status
      ELSE status
    END
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_updates_invoice
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_on_payment();

CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices 
  SET status = 'overdue'
  WHERE status = 'sent'
    AND due_date < CURRENT_DATE
    AND balance_due > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- NOTE: RLS is enabled but policies are minimal. Currently using service_role
-- key which bypasses RLS. Before adding user authentication, define proper
-- policies for each table based on user roles.
-- ============================================================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_payment_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Public invoice viewing (for customer invoice links)
CREATE POLICY "Public invoice view by public_id" ON invoices
  FOR SELECT
  USING (public_id IS NOT NULL);
