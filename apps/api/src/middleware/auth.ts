import { createMiddleware } from "hono/factory";
import type { Bindings, Variables } from "./types";
import { getSql } from "../db";

/** Stub auth: send `Authorization: Bearer <user-uuid>` after POST /auth/stub. */
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

  const sql = getSql(c.env);
  const rows = await sql`
    SELECT id, email, display_name, role
    FROM users
    WHERE id = ${token}::uuid
  `;

  if (rows.length === 0) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const row = rows[0] as {
    id: string;
    email: string;
    display_name: string;
    role: "business" | "specialist" | "admin";
  };

  c.set("user", {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  });

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
