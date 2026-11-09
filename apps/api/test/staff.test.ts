import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { setSqlOverride } from "../src/db";
import {
  ERR_FOUNDER_IMMUTABLE,
  ERR_MANAGED_ONLY,
  ERR_MANAGED_ROLE,
  FOUNDER_OWNER_EMAIL,
} from "../src/auth/roles";
import { loginTokenForUser, resetTestDb, testDbState, type MockUser } from "./mock-sql";

const env = {
  DATABASE_URL: "postgres://mock/css",
  REPORT_PHOTOS: {} as R2Bucket,
};

const FOUNDER_ID = "00000000-0000-4000-8000-000000000010";
const ADMIN_ID = "00000000-0000-4000-8000-000000000020";
const SPEC_ID = "00000000-0000-4000-8000-000000000030";
const BIZ_ID = "00000000-0000-4000-8000-000000000040";
const OTHER_FOUNDER_ID = "00000000-0000-4000-8000-000000000050";

function seed(user: MockUser) {
  testDbState.users.push(user);
}

async function tokenFor(id: string) {
  return loginTokenForUser(testDbState.sql, id);
}

function authed(token: string, method: string, path: string, body?: unknown) {
  return app.request(
    path,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );
}

describe("founder staff management", () => {
  beforeEach(() => {
    setSqlOverride(testDbState.sql);
    resetTestDb();
    seed({
      id: FOUNDER_ID,
      email: FOUNDER_OWNER_EMAIL,
      display_name: "Markk",
      role: "founder",
      password_hash: "seeded",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    seed({
      id: ADMIN_ID,
      email: "admin@css.app",
      display_name: "Ada Admin",
      role: "admin",
      password_hash: "seeded",
      created_at: "2026-01-02T00:00:00.000Z",
    });
    seed({
      id: SPEC_ID,
      email: "zoe@css.app",
      display_name: "Zoe Specialist",
      role: "specialist",
      password_hash: "seeded",
      created_at: "2026-01-03T00:00:00.000Z",
    });
    seed({
      id: BIZ_ID,
      email: "biz@css.app",
      display_name: "Biz",
      role: "business",
      password_hash: "seeded",
      created_at: "2026-01-04T00:00:00.000Z",
    });
  });

  afterEach(() => {
    setSqlOverride(null);
    resetTestDb();
  });

  it("lets founder pass the admin check and keeps marketplace roles separate", async () => {
    const founder = await tokenFor(FOUNDER_ID);
    const admin = await tokenFor(ADMIN_ID);
    const specialist = await tokenFor(SPEC_ID);
    const business = await tokenFor(BIZ_ID);

    const founderAdmin = await authed(founder, "GET", "/admin/me");
    expect(founderAdmin.status).toBe(200);
    const founderBody = (await founderAdmin.json()) as { user: { role: string }; adminAccess: boolean };
    expect(founderBody.adminAccess).toBe(true);
    expect(founderBody.user.role).toBe("founder");

    expect((await authed(admin, "GET", "/admin/me")).status).toBe(200);
    expect((await authed(specialist, "GET", "/admin/me")).status).toBe(403);
    expect((await authed(business, "GET", "/admin/me")).status).toBe(403);

    expect((await authed(founder, "POST", "/missions", { title: "x", paymentCents: 1 })).status).toBe(403);
    expect((await authed(founder, "GET", "/missions/available")).status).toBe(403);
    expect((await authed(admin, "GET", "/missions/mine")).status).toBe(403);
    expect((await authed(admin, "GET", "/staff")).status).toBe(403);
  });

  it("lists only specialist staff and admins, highest role first", async () => {
    seed({
      id: "00000000-0000-4000-8000-000000000031",
      email: "ada@css.app",
      display_name: "Ada Spec",
      role: "specialist",
      password_hash: "seeded",
      created_at: "2026-01-05T00:00:00.000Z",
    });
    const founder = await tokenFor(FOUNDER_ID);
    const res = await authed(founder, "GET", "/staff");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      accounts: Array<{ email: string; role: string; displayName: string }>;
    };
    expect(json.accounts.map((account) => account.email)).toEqual([
      "admin@css.app",
      "ada@css.app",
      "zoe@css.app",
    ]);
    expect(json.accounts.map((account) => account.role)).toEqual([
      "admin",
      "specialist",
      "specialist",
    ]);
    expect(JSON.stringify(json)).not.toContain("password");
    expect(json.accounts.some((account) => account.email === FOUNDER_OWNER_EMAIL)).toBe(false);
  });

  it("promotes specialist staff to admin and demotes admin to specialist", async () => {
    const founder = await tokenFor(FOUNDER_ID);
    const specialistToken = await tokenFor(SPEC_ID);

    const promoted = await authed(founder, "PATCH", `/staff/${SPEC_ID}`, { role: "admin" });
    expect(promoted.status).toBe(200);
    const promotedBody = (await promoted.json()) as { account: { role: string } };
    expect(promotedBody.account.role).toBe("admin");
    expect((await authed(specialistToken, "GET", "/admin/me")).status).toBe(200);
    expect((await authed(specialistToken, "GET", "/staff")).status).toBe(403);

    const demoted = await authed(founder, "PATCH", `/staff/${ADMIN_ID}`, { role: "specialist" });
    expect(demoted.status).toBe(200);
    const demotedBody = (await demoted.json()) as { account: { role: string; email: string } };
    expect(demotedBody.account.role).toBe("specialist");
    expect(demotedBody.account.email).toBe("admin@css.app");
    expect(testDbState.specialists.some((row) => row.user_id === ADMIN_ID && row.level === 1)).toBe(true);
    const adminToken = await tokenFor(ADMIN_ID);
    expect((await authed(adminToken, "GET", "/admin/me")).status).toBe(403);
  });

  it("removes an admin and revokes that session", async () => {
    const founder = await tokenFor(FOUNDER_ID);
    const admin = await tokenFor(ADMIN_ID);
    const removed = await authed(founder, "DELETE", `/staff/${ADMIN_ID}`);
    expect(removed.status).toBe(200);
    expect(testDbState.users.some((user) => user.id === ADMIN_ID)).toBe(false);
    expect((await authed(admin, "GET", "/auth/me")).status).toBe(401);

    const listed = await authed(founder, "GET", "/staff");
    const json = (await listed.json()) as { accounts: Array<{ id: string }> };
    expect(json.accounts.some((account) => account.id === ADMIN_ID)).toBe(false);
  });

  it("refuses to change or remove a founder", async () => {
    seed({
      id: OTHER_FOUNDER_ID,
      email: "second-founder@css.app",
      display_name: "Second",
      role: "founder",
      password_hash: "seeded",
      created_at: "2026-01-06T00:00:00.000Z",
    });
    const founder = await tokenFor(FOUNDER_ID);
    const admin = await tokenFor(ADMIN_ID);
    const specialist = await tokenFor(SPEC_ID);
    const business = await tokenFor(BIZ_ID);

    for (const token of [founder, admin, specialist, business]) {
      const patch = await authed(token, "PATCH", `/staff/${OTHER_FOUNDER_ID}`, { role: "admin" });
      const del = await authed(token, "DELETE", `/staff/${FOUNDER_ID}`);
      expect(patch.status).toBe(403);
      expect(del.status).toBe(403);
    }

    const founderPatch = await authed(founder, "PATCH", `/staff/${FOUNDER_ID}`, { role: "specialist" });
    expect(founderPatch.status).toBe(403);
    expect(((await founderPatch.json()) as { error: string }).error).toBe(ERR_FOUNDER_IMMUTABLE);

    const selfDelete = await authed(founder, "DELETE", `/staff/${FOUNDER_ID}`);
    expect(((await selfDelete.json()) as { error: string }).error).toBe(ERR_FOUNDER_IMMUTABLE);

    expect(testDbState.users.find((user) => user.id === FOUNDER_ID)?.role).toBe("founder");
    expect(testDbState.users.find((user) => user.id === OTHER_FOUNDER_ID)?.role).toBe("founder");
    const me = await authed(founder, "GET", "/auth/me");
    expect(((await me.json()) as { user: { role: string } }).user.role).toBe("founder");
  });

  it("rejects unmanaged targets, founder assignment, and bad ids", async () => {
    const founder = await tokenFor(FOUNDER_ID);
    const businessTarget = await authed(founder, "PATCH", `/staff/${BIZ_ID}`, { role: "admin" });
    expect(businessTarget.status).toBe(403);
    expect(((await businessTarget.json()) as { error: string }).error).toBe(ERR_MANAGED_ONLY);
    expect(testDbState.users.find((user) => user.id === BIZ_ID)?.role).toBe("business");

    const assignFounder = await authed(founder, "PATCH", `/staff/${SPEC_ID}`, { role: "founder" });
    expect(assignFounder.status).toBe(400);
    expect(((await assignFounder.json()) as { error: string }).error).toBe(ERR_MANAGED_ROLE);

    const missing = await authed(founder, "DELETE", "/staff/00000000-0000-4000-8000-000000000099");
    expect(missing.status).toBe(404);

    const badId = await authed(founder, "PATCH", "/staff/not-a-uuid", { role: "admin" });
    expect(badId.status).toBe(400);

    expect((await authed(founder, "GET", "/staff")).status).toBe(200);
    expect((await app.request("/staff", {}, env)).status).toBe(401);
  });
});
