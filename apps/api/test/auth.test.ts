import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { setSqlOverride } from "../src/db";
import { testDbState } from "./mock-sql";

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
    testDbState.users.length = 0;
    testDbState.sessions.length = 0;
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
});
