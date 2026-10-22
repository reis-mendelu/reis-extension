-- Hash existing raw student_id values in feedback and usage tables
-- to match the new client-side SHA-256 hashing

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- daily_active_usage: composite PK (student_id, usage_date)
-- We need to handle potential conflicts when hashed IDs collide with existing hashed rows
UPDATE daily_active_usage
SET student_id = encode(extensions.digest(student_id, 'sha256'), 'hex')
WHERE length(student_id) < 64;

-- feedback_responses: unique index on (student_id, feedback_type, semester_code)
UPDATE feedback_responses
SET student_id = encode(extensions.digest(student_id, 'sha256'), 'hex')
WHERE length(student_id) < 64;
