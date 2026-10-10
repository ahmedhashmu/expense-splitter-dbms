-- For a database that already ran the first schema.sql.
-- Adds login support. Existing demo users get the password: demo1234
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE users
SET password_hash = '$2b$12$2bUeoSzBpWS/ikj5CK025.L55FvG0o3I8j/sH5Q2lq6ZEHJJNdCDe'
WHERE password_hash IS NULL;

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
