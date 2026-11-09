export type UserRole = "business" | "specialist" | "admin" | "founder";

/** Keep in sync with apps/api/src/auth/roles.ts (low → high). */
export const ROLE_ORDER = ["business", "specialist", "admin", "founder"] as const satisfies readonly UserRole[];

export const PUBLIC_REGISTER_ROLES = ["business", "specialist"] as const;
export type PublicRegisterRole = (typeof PUBLIC_REGISTER_ROLES)[number];

/** Specialist staff and admins. Founder is not selectable. */
export const MANAGED_ROLES = ["specialist", "admin"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

const RANK: Record<UserRole, number> = {
  business: 0,
  specialist: 1,
  admin: 2,
  founder: 3,
};

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "business":
      return "Business";
    case "specialist":
      return "Specialist";
    case "admin":
      return "Admin";
    case "founder":
      return "Founder";
  }
}

export function roleRank(role: UserRole): number {
  return RANK[role];
}

export function homePath(role: UserRole): string {
  switch (role) {
    case "business":
      return "/business";
    case "specialist":
      return "/specialist";
    case "admin":
      return "/admin";
    case "founder":
      return "/founder";
  }
}

/** Founder sits above admin and passes every admin route guard. */
export function hasAdminAccess(role: UserRole): boolean {
  return role === "admin" || role === "founder";
}
