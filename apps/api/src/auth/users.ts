import type { AuthUser, UserRole } from "../types";

export function mapUser(row: {
  id: string;
  email: string;
  display_name: string;
  role: UserRole | string;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as UserRole,
  };
}
