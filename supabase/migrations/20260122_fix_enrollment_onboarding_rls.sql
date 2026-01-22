-- Fix enrollment_onboarding table access
-- This internal admin app doesn't use RLS (other tables like families, enrollments have RLS disabled)
-- The RLS policies were blocking authenticated users from reading the data

-- Disable RLS to match other tables in this internal admin app
ALTER TABLE enrollment_onboarding DISABLE ROW LEVEL SECURITY;

-- Drop the policies since they're no longer needed
DROP POLICY IF EXISTS "Users can view onboarding for their families" ON enrollment_onboarding;
DROP POLICY IF EXISTS "Authenticated users can view onboarding" ON enrollment_onboarding;
DROP POLICY IF EXISTS "Authenticated users can insert onboarding" ON enrollment_onboarding;
DROP POLICY IF EXISTS "Authenticated users can update onboarding" ON enrollment_onboarding;
DROP POLICY IF EXISTS "Authenticated users can delete onboarding" ON enrollment_onboarding;
