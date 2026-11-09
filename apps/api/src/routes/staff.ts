import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { getSql } from "../db";
import {
  ERR_MANAGED_ONLY,
  ERR_MANAGED_ROLE,
  accountMutationBlock,
  isManagedRole,
  isUserRole,
  type ManagedRole,
} from "../auth/roles";

const staff = new Hono<{ Bindings: Bindings; Variables: Variables }>();

staff.use("*", authMiddleware);
staff.use("*", requireRole("founder"));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: unknown;
};

function asTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapAccount(row: AccountRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as ManagedRole,
    createdAt: asTimestamp(row.created_at),
  };
}

async function loadAccount(
  sql: ReturnType<typeof getSql>,
  id: string,
): Promise<AccountRow | null> {
  const rows = await sql`
    SELECT id, email, display_name, role, created_at
    FROM users
    WHERE id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  return rows[0] as AccountRow;
}

staff.get("/", async (c) => {
  const sql = getSql(c.env);
  const rows = await sql`
    SELECT id, email, display_name, role, created_at
    FROM users
    WHERE role IN ('specialist'::user_role, 'admin'::user_role)
    ORDER BY role DESC, email ASC
  `;
  const accounts = (rows as AccountRow[])
    .filter((row) => isManagedRole(row.role))
    .map(mapAccount);
  return c.json({ accounts });
});

staff.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) {
    return c.json({ error: "Invalid account id" }, 400);
  }

  const sql = getSql(c.env);
  const target = await loadAccount(sql, id);
  if (!target) {
    return c.json({ error: "Account not found" }, 404);
  }

  if (!isUserRole(target.role)) {
    return c.json({ error: ERR_MANAGED_ONLY }, 403);
  }
  const block = accountMutationBlock(c.get("user").role, target.role);
  if (block) {
    return c.json({ error: block.error }, block.status);
  }

  const body = await c.req.json<{ role?: string }>();
  if (!body.role || !isManagedRole(body.role)) {
    return c.json({ error: ERR_MANAGED_ROLE }, 400);
  }
  const nextRole = body.role;

  const updated = await sql`
    UPDATE users
    SET role = ${nextRole}::user_role
    WHERE id = ${id}::uuid
    RETURNING id, email, display_name, role, created_at
  `;
  if (updated.length === 0) {
    return c.json({ error: "Account not found" }, 404);
  }

  if (nextRole === "specialist") {
    await sql`
      INSERT INTO specialists (user_id, level, category)
      VALUES (${id}::uuid, ${1}, ${null})
      ON CONFLICT (user_id) DO NOTHING
    `;
  }

  return c.json({ account: mapAccount(updated[0] as AccountRow) });
});

staff.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) {
    return c.json({ error: "Invalid account id" }, 400);
  }

  const sql = getSql(c.env);
  const target = await loadAccount(sql, id);
  if (!target) {
    return c.json({ error: "Account not found" }, 404);
  }

  if (!isUserRole(target.role)) {
    return c.json({ error: ERR_MANAGED_ONLY }, 403);
  }
  const block = accountMutationBlock(c.get("user").role, target.role);
  if (block) {
    return c.json({ error: block.error }, block.status);
  }

  await sql`DELETE FROM sessions WHERE user_id = ${id}::uuid`;
  const removed = await sql`
    DELETE FROM users WHERE id = ${id}::uuid RETURNING id
  `;
  if (removed.length === 0) {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({ ok: true });
});

export default staff;
