import { Hono } from "hono";
import type { Bindings, Variables } from "./types";
import authRoutes from "./routes/auth";
import missionRoutes from "./routes/missions";
import assignmentRoutes from "./routes/assignments";
import photoRoutes from "./routes/photos";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin") ?? "*";
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  c.header("Access-Control-Max-Age", "86400");
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

app.get("/", (c) =>
  c.json({
    name: "CSS API",
    description: "Customer Service Specialists marketplace API",
    health: "ok",
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/missions", missionRoutes);
app.route("/assignments", assignmentRoutes);
app.route("/reports/photos", photoRoutes);

export default app;
