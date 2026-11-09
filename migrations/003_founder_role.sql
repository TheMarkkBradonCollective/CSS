-- Founder sits above admin. A new enum value cannot be used until this migration commits,
-- so the owner assignment is migrations/004_founder_owner.sql.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder' AFTER 'admin';
