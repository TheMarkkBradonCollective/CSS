import { Hono } from "hono";
import type { Bindings } from "../types";
import { getSql } from "../db";

const auth = new Hono<{ Bindings: Bindings }>();

auth.post("/stub", async (c) => {
  const body = await c.req.json<{
    email: string;
    displayName: string;
    role: "business" | "specialist";
    businessName?: string;
    specialistLevel?: number;
    specialistCategory?: string;
  }>();

  if (!body.email || !body.displayName || !body.role) {
    return c.json({ error: "email, displayName, and role are required" }, 400);
  }

  const sql = getSql(c.env);

  const users = await sql`
    INSERT INTO users (email, display_name, role)
    VALUES (${body.email}, ${body.displayName}, ${body.role}::user_role)
    ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
    RETURNING id, email, display_name, role
  `;

  const user = users[0] as {
    id: string;
    email: string;
    display_name: string;
    role: string;
  };

  if (body.role === "business") {
    const name = body.businessName ?? `${body.displayName}'s Business`;
    await sql`
      INSERT INTO businesses (user_id, name)
      VALUES (${user.id}::uuid, ${name})
      ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name
    `;
  }

  if (body.role === "specialist") {
    const level = Math.min(5, Math.max(1, body.specialistLevel ?? 1));
    await sql`
      INSERT INTO specialists (user_id, level, category)
      VALUES (${user.id}::uuid, ${level}, ${body.specialistCategory ?? null})
      ON CONFLICT (user_id) DO UPDATE SET
        level = EXCLUDED.level,
        category = EXCLUDED.category
    `;
  }

  return c.json({
    token: user.id,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    },
  });
});

export default auth;
