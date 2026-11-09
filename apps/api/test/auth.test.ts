import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { setSqlOverride } from "../src/db";
import { FOUNDER_OWNER_EMAIL } from "../src/auth/roles";
import { resetTestDb, testDbState } from "./mock-sql";

const env = {
  DATABASE_URL: "postgres://mock/css",
  REPORT_PHOTOS: {} as R2Bucket,
};

describe("auth routes", () => {
  beforeEach(() => {
    setSqlOverride(testDbState.sql);
  });

  afterEach(() => {
    setSqlOverride(null);
    resetTestDb();
  });

  it("registers a business user and returns a session token", async () => {
    const res = await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "biz@css.app",
          password: "password123",
          displayName: "Biz Owner",
          role: "business",
          businessName: "Acme",
        }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      token: string;
      user: { email: string; role: string };
    };
    expect(json.token.length).toBeGreaterThan(10);
    expect(json.user.email).toBe("biz@css.app");
    expect(json.user.role).toBe("business");
  });

  it("logs in with email and password", async () => {
    await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "spec@css.app",
          password: "password123",
          displayName: "Spec",
          role: "specialist",
          specialistLevel: 3,
        }),
      },
      env,
    );

    const res = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "spec@css.app",
          password: "password123",
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { token: string; user: { role: string } };
    expect(json.user.role).toBe("specialist");
    expect(json.token).toBeTruthy();
  });

  it("rejects login with wrong password", async () => {
    await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "wrong@css.app",
          password: "password123",
          displayName: "User",
          role: "business",
        }),
      },
      env,
    );

    const res = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "wrong@css.app",
          password: "not-the-password",
        }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("GET /auth/me requires a valid session", async () => {
    const register = await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "me@css.app",
          password: "password123",
          displayName: "Me",
          role: "business",
        }),
      },
      env,
    );
    const { token } = (await register.json()) as { token: string };

    const authed = await app.request(
      "/auth/me",
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(authed.status).toBe(200);
    const me = (await authed.json()) as { user: { email: string } };
    expect(me.user.email).toBe("me@css.app");

    const missing = await app.request("/auth/me", {}, env);
    expect(missing.status).toBe(401);
  });

  it("POST /auth/logout clears the session", async () => {
    const register = await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "out@css.app",
          password: "password123",
          displayName: "Out",
          role: "business",
        }),
      },
      env,
    );
    const { token } = (await register.json()) as { token: string };

    const logout = await app.request(
      "/auth/logout",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
      env,
    );
    expect(logout.status).toBe(200);

    const me = await app.request(
      "/auth/me",
      { headers: { Authorization: `Bearer ${token}` } },
      env,
    );
    expect(me.status).toBe(401);
  });

  it("rejects self-service registration as admin or founder", async () => {
    for (const role of ["admin", "founder"]) {
      const res = await app.request(
        "/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `${role}@css.app`,
            password: "password123",
            displayName: "Nope",
            role,
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/business or specialist/);
    }
    expect(testDbState.users).toHaveLength(0);
  });

  it("lets the seeded owner set a password without leaving founder", async () => {
    testDbState.users.push({
      id: "00000000-0000-4000-8000-000000000010",
      email: FOUNDER_OWNER_EMAIL,
      display_name: "Markk",
      role: "founder",
      password_hash: null,
      created_at: "2026-01-01T00:00:00.000Z",
    });

    const res = await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FOUNDER_OWNER_EMAIL,
          password: "password123",
          displayName: "Markk",
          role: "business",
        }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { token: string; user: { role: string; email: string } };
    expect(json.user.role).toBe("founder");
    expect(json.user.email).toBe(FOUNDER_OWNER_EMAIL);
    expect(testDbState.businesses).toHaveLength(0);
    expect(testDbState.users).toHaveLength(1);
    expect(testDbState.users[0]?.role).toBe("founder");
    expect(testDbState.users[0]?.password_hash).toBeTruthy();

    const login = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FOUNDER_OWNER_EMAIL,
          password: "password123",
        }),
      },
      env,
    );
    expect(login.status).toBe(200);
    const loggedIn = (await login.json()) as { user: { role: string } };
    expect(loggedIn.user.role).toBe("founder");

    const again = await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FOUNDER_OWNER_EMAIL,
          password: "password123",
          displayName: "Markk",
          role: "admin",
        }),
      },
      env,
    );
    expect(again.status).toBe(409);
    expect(testDbState.users[0]?.role).toBe("founder");
  });

  it("does not let another passwordless founder claim the owner flow", async () => {
    testDbState.users.push({
      id: "00000000-0000-4000-8000-000000000011",
      email: "other-founder@css.app",
      display_name: "Other",
      role: "founder",
      password_hash: null,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const res = await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "other-founder@css.app",
          password: "password123",
          displayName: "Other",
          role: "specialist",
        }),
      },
      env,
    );
    expect(res.status).toBe(409);
    expect(testDbState.users[0]?.password_hash).toBeNull();
    expect(testDbState.users[0]?.role).toBe("founder");
  });
});
