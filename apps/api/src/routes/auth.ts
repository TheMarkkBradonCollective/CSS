import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { getSql } from "../db";
import { hashPassword, validatePassword, verifyPassword } from "../auth/password";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiresAt,
} from "../auth/session";
import { mapUser } from "../auth/users";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function createSession(
  env: Bindings,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = sessionExpiresAt();
  const sql = getSql(env);
  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}::uuid, ${tokenHash}, ${expiresAt.toISOString()}::timestamptz)
  `;
  return { token, expiresAt };
}

auth.post("/register", async (c) => {
  const body = await c.req.json<{
    email: string;
    password: string;
    displayName: string;
    role: "business" | "specialist";
    businessName?: string;
    specialistLevel?: number;
    specialistCategory?: string;
  }>();

  const email = body.email?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const passwordError = validatePassword(body.password ?? "");
  if (!email || !displayName || !body.role) {
    return c.json({ error: "email, password, displayName, and role are required" }, 400);
  }
  if (passwordError) {
    return c.json({ error: passwordError }, 400);
  }
  if (body.role !== "business" && body.role !== "specialist") {
    return c.json({ error: "role must be business or specialist" }, 400);
  }

  const sql = getSql(c.env);
  const existing = await sql`
    SELECT id FROM users WHERE email = ${email}
  `;
  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await hashPassword(body.password);
  const users = await sql`
    INSERT INTO users (email, display_name, role, password_hash)
    VALUES (
      ${email},
      ${displayName},
      ${body.role}::user_role,
      ${passwordHash}
    )
    RETURNING id, email, display_name, role
  `;
  const user = users[0] as {
    id: string;
    email: string;
    display_name: string;
    role: "business" | "specialist";
  };

  if (body.role === "business") {
    const name = body.businessName?.trim() || `${displayName}'s Business`;
    await sql`
      INSERT INTO businesses (user_id, name)
      VALUES (${user.id}::uuid, ${name})
    `;
  } else {
    const level = Math.min(5, Math.max(1, body.specialistLevel ?? 1));
    await sql`
      INSERT INTO specialists (user_id, level, category)
      VALUES (${user.id}::uuid, ${level}, ${body.specialistCategory ?? null})
    `;
  }

  const session = await createSession(c.env, user.id);
  return c.json(
    {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: mapUser(user),
    },
    201,
  );
});

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const sql = getSql(c.env);
  const rows = await sql`
    SELECT id, email, display_name, role, password_hash
    FROM users
    WHERE email = ${email}
  `;
  if (rows.length === 0) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const row = rows[0] as {
    id: string;
    email: string;
    display_name: string;
    role: "business" | "specialist" | "admin";
    password_hash: string | null;
  };

  if (!row.password_hash) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(body.password, row.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const session = await createSession(c.env, row.id);
  return c.json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: mapUser(row),
  });
});

auth.post("/logout", authMiddleware, async (c) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : null;
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const tokenHash = await hashSessionToken(token);
  const sql = getSql(c.env);
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
  return c.json({ ok: true });
});

auth.get("/me", authMiddleware, async (c) => {
  return c.json({ user: c.get("user") });
});

export default auth;
