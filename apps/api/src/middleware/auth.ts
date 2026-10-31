import { createMiddleware } from "hono/factory";
import type { Bindings, Variables } from "../types";
import { getSql } from "../db";
import { hashSessionToken } from "../auth/session";
import { mapUser } from "../auth/users";

/** Send `Authorization: Bearer <session-token>` from login or register. */
export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tokenHash = await hashSessionToken(token);
  const sql = getSql(c.env);
  const rows = await sql`
    SELECT u.id, u.email, u.display_name, u.role
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > now()
  `;

  if (rows.length === 0) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  c.set("user", mapUser(rows[0] as {
    id: string;
    email: string;
    display_name: string;
    role: "business" | "specialist" | "admin";
  }));

  await next();
});

export function requireRole(...roles: Array<"business" | "specialist" | "admin">) {
  return createMiddleware<{
    Bindings: Bindings;
    Variables: Variables;
  }>(async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
