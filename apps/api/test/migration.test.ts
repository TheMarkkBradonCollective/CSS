import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FOUNDER_OWNER_EMAIL } from "../src/auth/roles";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsDir = join(root, "migrations");

describe("founder migrations", () => {
  it("adds founder above admin before assigning the owner", () => {
    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const enumIndex = files.indexOf("003_founder_role.sql");
    const ownerIndex = files.indexOf("004_founder_owner.sql");
    expect(enumIndex).toBeGreaterThanOrEqual(0);
    expect(ownerIndex).toBe(enumIndex + 1);

    const enumSql = readFileSync(join(migrationsDir, "003_founder_role.sql"), "utf8");
    expect(enumSql).toContain(
      "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'founder' AFTER 'admin'",
    );
    expect(enumSql).not.toContain(FOUNDER_OWNER_EMAIL);

    const ownerSql = readFileSync(join(migrationsDir, "004_founder_owner.sql"), "utf8");
    expect(ownerSql).toContain(FOUNDER_OWNER_EMAIL);
    expect(ownerSql).toContain("'founder'::user_role");
    expect(ownerSql).toContain("'Markk'");
    const lowered = ownerSql.toLowerCase();
    expect(lowered).not.toContain("password");
    expect(lowered).not.toContain("secret");
    expect(lowered).not.toContain("token");
    expect(lowered).not.toContain("hash");
    expect(lowered).not.toContain("database_url");
  });
});
