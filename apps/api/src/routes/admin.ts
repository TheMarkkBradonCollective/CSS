import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

admin.use("*", authMiddleware);

/** Admin gate. Founder passes via roleIsAllowed inside requireRole. */
admin.get("/me", requireRole("admin"), (c) => {
  const user = c.get("user");
  return c.json({ user, adminAccess: true });
});

export default admin;
