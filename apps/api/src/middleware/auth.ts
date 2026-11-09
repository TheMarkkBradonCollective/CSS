import { createMiddleware } from "hono/factory";
import type { Bindings, UserRole, Variables } from "../types";
import { getSql } from "../db";
import { hashSessionToken } from "../auth/session";
import { mapUser } from "../auth/users";
import { isUserRole, roleIsAllowed } from "../auth/roles";

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

  const row = rows[0] as {
    id: string;
    email: string;
    display_name: string;
    role: string;
  };
  if (!isUserRole(row.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  c.set("user", mapUser(row));

  await next();
});

/**
 * Role gate. Founder passes every check that includes admin
 * (see roleIsAllowed) and does not inherit business or specialist routes.
 */
export function requireRole(...roles: UserRole[]) {
  return createMiddleware<{
    Bindings: Bindings;
    Variables: Variables;
  }>(async (c, next) => {
    const user = c.get("user");
    if (!roleIsAllowed(user.role, roles)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
