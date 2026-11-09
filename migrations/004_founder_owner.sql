-- Assign founder to the owner. Apply only after 003_founder_role.sql.
-- Role value: founder. No credential material is stored in this migration.

UPDATE users
SET role = 'founder'::user_role
WHERE lower(email) = 'themarkkbrandoncollective@gmail.com'
  AND role IS DISTINCT FROM 'founder'::user_role;

INSERT INTO users (email, display_name, role)
SELECT 'themarkkbrandoncollective@gmail.com', 'Markk', 'founder'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM users
  WHERE lower(email) = 'themarkkbrandoncollective@gmail.com'
);
