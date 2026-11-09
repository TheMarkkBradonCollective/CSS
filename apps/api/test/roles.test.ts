import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ERR_FOUNDER_IMMUTABLE,
  ERR_MANAGED_ONLY,
  FOUNDER_OWNER_EMAIL,
  ROLE_ORDER,
  accountMutationBlock,
  hasAdminAccess,
  roleIsAllowed,
  roleRank,
} from "../src/auth/roles";
import type { UserRole } from "../src/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("role hierarchy", () => {
  it("orders founder strictly above admin, specialist, and business", () => {
    const roles: UserRole[] = ["business", "specialist", "admin", "founder"];
    expect(ROLE_ORDER).toEqual(roles);
    expect(roleRank("founder")).toBeGreaterThan(roleRank("admin"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("specialist"));
    expect(roleRank("specialist")).toBeGreaterThan(roleRank("business"));
  });

  it("lets founder pass every check that admin passes, and only those", () => {
    expect(roleIsAllowed("founder", ["admin"])).toBe(true);
    expect(roleIsAllowed("admin", ["admin"])).toBe(true);
    expect(roleIsAllowed("founder", ["business", "admin"])).toBe(true);
    expect(roleIsAllowed("founder", ["founder"])).toBe(true);
    expect(hasAdminAccess("founder")).toBe(true);
    expect(hasAdminAccess("admin")).toBe(true);

    expect(roleIsAllowed("founder", ["business"])).toBe(false);
    expect(roleIsAllowed("founder", ["specialist"])).toBe(false);
    expect(roleIsAllowed("admin", ["founder"])).toBe(false);
    expect(roleIsAllowed("admin", ["business"])).toBe(false);
    expect(roleIsAllowed("specialist", ["admin"])).toBe(false);
    expect(roleIsAllowed("business", ["admin"])).toBe(false);
    expect(hasAdminAccess("specialist")).toBe(false);
    expect(hasAdminAccess("business")).toBe(false);
  });

  it("allows a founder to manage staff and admins and blocks founder targets", () => {
    expect(accountMutationBlock("founder", "specialist")).toBeNull();
    expect(accountMutationBlock("founder", "admin")).toBeNull();
    expect(accountMutationBlock("founder", "founder")).toEqual({
      status: 403,
      error: ERR_FOUNDER_IMMUTABLE,
    });
    expect(accountMutationBlock("admin", "founder")).toEqual({
      status: 403,
      error: ERR_FOUNDER_IMMUTABLE,
    });
    expect(accountMutationBlock("specialist", "founder")).toEqual({
      status: 403,
      error: ERR_FOUNDER_IMMUTABLE,
    });
    expect(accountMutationBlock("business", "founder")).toEqual({
      status: 403,
      error: ERR_FOUNDER_IMMUTABLE,
    });
    expect(accountMutationBlock("founder", "business")).toEqual({
      status: 403,
      error: ERR_MANAGED_ONLY,
    });
    expect(accountMutationBlock("admin", "specialist")?.error).toBe("Forbidden");
    expect(accountMutationBlock("admin", "admin")?.error).toBe("Forbidden");
    expect(accountMutationBlock("specialist", "admin")?.error).toBe("Forbidden");
  });

  it("keeps the web role order and admin guard aligned", () => {
    const web = readFileSync(join(root, "apps/web/src/roles.ts"), "utf8");
    expect(web).toContain('["business", "specialist", "admin", "founder"]');
    expect(web).toContain('return role === "admin" || role === "founder"');
    expect(web).not.toContain(FOUNDER_OWNER_EMAIL);
  });
});
