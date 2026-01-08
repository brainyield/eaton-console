-- Auto-generate desk_token for new teachers using a trigger
-- Drop existing function first (if exists with different signature)
DROP FUNCTION IF EXISTS generate_desk_token() CASCADE;

-- Create function to generate desk token
CREATE OR REPLACE FUNCTION generate_desk_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if desk_token is not provided
  IF NEW.desk_token IS NULL THEN
    -- Generate a URL-safe random token (16 chars)
    NEW.desk_token := encode(gen_random_bytes(12), 'base64');
    -- Replace URL-unsafe characters
    NEW.desk_token := replace(replace(replace(NEW.desk_token, '+', 'x'), '/', 'y'), '=', '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate token on insert
DROP TRIGGER IF EXISTS teacher_desk_token_trigger ON teachers;
CREATE TRIGGER teacher_desk_token_trigger
  BEFORE INSERT ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION generate_desk_token();

-- Generate tokens for any existing teachers that don't have one
UPDATE teachers
SET desk_token = replace(replace(replace(encode(gen_random_bytes(12), 'base64'), '+', 'x'), '/', 'y'), '=', '')
WHERE desk_token IS NULL;
