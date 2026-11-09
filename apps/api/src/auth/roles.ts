import type { UserRole } from "../types";

/** Low → high. Founder is strictly above admin, the previous top role. */
export const ROLE_ORDER = ["business", "specialist", "admin", "founder"] as const satisfies readonly UserRole[];

/**
 * Specialist accounts are platform staff. Founder can manage these roles and admin.
 * Founder is intentionally absent: no other role can assign it here.
 */
export const MANAGED_ROLES = ["specialist", "admin"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

export const PUBLIC_REGISTER_ROLES = ["business", "specialist"] as const;
export type PublicRegisterRole = (typeof PUBLIC_REGISTER_ROLES)[number];

/** Owner who must hold founder. Duplicate of migrations/004_founder_owner.sql. */
export const FOUNDER_OWNER_EMAIL = "themarkkbrandoncollective@gmail.com";

export const ERR_FOUNDER_IMMUTABLE = "A founder account cannot be changed or removed";
export const ERR_MANAGED_ONLY = "Only staff and admin accounts can be managed";
export const ERR_MANAGED_ROLE = "role must be specialist or admin";

const RANK: Record<UserRole, number> = {
  business: 0,
  specialist: 1,
  admin: 2,
  founder: 3,
};

export function isUserRole(role: string): role is UserRole {
  return (ROLE_ORDER as readonly string[]).includes(role);
}

export function isManagedRole(role: string): role is ManagedRole {
  return (MANAGED_ROLES as readonly string[]).includes(role);
}

export function isPublicRegisterRole(role: string): role is PublicRegisterRole {
  return (PUBLIC_REGISTER_ROLES as readonly string[]).includes(role);
}

export function roleRank(role: UserRole): number {
  return RANK[role];
}

/**
 * Founder has every permission admin has: an allow-list that includes admin
 * also allows founder. Founder does not inherit business or specialist checks.
 */
export function roleIsAllowed(role: UserRole, allowed: readonly UserRole[]): boolean {
  if (allowed.includes(role)) return true;
  if (role === "founder" && allowed.includes("admin")) return true;
  return false;
}

/** Admin route guard. Founder passes because it sits above admin. */
export function hasAdminAccess(role: UserRole): boolean {
  return roleIsAllowed(role, ["admin"]);
}

/**
 * Block account management. Founder targets are refused for every actor,
 * including another founder. Only a founder may change specialist staff or admins.
 */
export function accountMutationBlock(
  actorRole: UserRole,
  targetRole: UserRole,
): { status: 403; error: string } | null {
  if (targetRole === "founder") {
    return { status: 403, error: ERR_FOUNDER_IMMUTABLE };
  }
  if (actorRole !== "founder") {
    return { status: 403, error: "Forbidden" };
  }
  if (!isManagedRole(targetRole)) {
    return { status: 403, error: ERR_MANAGED_ONLY };
  }
  return null;
}
