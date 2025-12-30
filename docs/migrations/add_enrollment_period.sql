-- Migration: Add enrollment_period column to enrollments table
-- Date: 2024-12-30
-- Description: Adds enrollment_period field to track semester (Fall/Spring/Summer YYYY)
--              or school year (YYYY-YYYY) for each enrollment

-- Add the column
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS enrollment_period text;

-- Add index for filtering by period
CREATE INDEX IF NOT EXISTS enrollments_period_idx ON enrollments(enrollment_period) WHERE enrollment_period IS NOT NULL;
