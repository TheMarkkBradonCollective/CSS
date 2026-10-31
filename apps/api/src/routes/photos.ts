import { Hono } from "hono";
import type { Bindings } from "../types";
import { getSql } from "../db";

const photos = new Hono<{ Bindings: Bindings }>();

photos.get("/:photoId", async (c) => {
  const photoId = c.req.param("photoId");
  const sql = getSql(c.env);
  const rows = await sql`
    SELECT r2_key, content_type FROM report_photos WHERE id = ${photoId}::uuid
  `;
  if (rows.length === 0) {
    return c.json({ error: "Photo not found" }, 404);
  }
  const { r2_key, content_type } = rows[0] as {
    r2_key: string;
    content_type: string;
  };
  const object = await c.env.REPORT_PHOTOS.get(r2_key);
  if (!object) {
    return c.json({ error: "Photo missing in storage" }, 404);
  }
  const headers = new Headers();
  headers.set("Content-Type", content_type);
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(object.body, { headers });
});

export default photos;
