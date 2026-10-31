import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { getSql } from "../db";

const assignments = new Hono<{ Bindings: Bindings; Variables: Variables }>();

assignments.use("*", authMiddleware);

assignments.post("/:id/report", requireRole("specialist"), async (c) => {
  const assignmentId = c.req.param("id");
  const user = c.get("user");
  const sql = getSql(c.env);

  const spec = await sql`
    SELECT id FROM specialists WHERE user_id = ${user.id}::uuid
  `;
  if (spec.length === 0) {
    return c.json({ error: "Specialist profile missing" }, 400);
  }
  const specialistId = (spec[0] as { id: string }).id;

  const assignmentRows = await sql`
    SELECT ma.id, ma.mission_id, ma.status, ma.specialist_id
    FROM mission_assignments ma
    WHERE ma.id = ${assignmentId}::uuid
  `;
  if (assignmentRows.length === 0) {
    return c.json({ error: "Assignment not found" }, 404);
  }
  const assignment = assignmentRows[0] as {
    id: string;
    mission_id: string;
    status: string;
    specialist_id: string;
  };

  if (assignment.specialist_id !== specialistId) {
    return c.json({ error: "Not your assignment" }, 403);
  }

  const form = await c.req.formData();
  const summary = String(form.get("summary") ?? "").trim();
  const findingsRaw = form.get("findings");
  let findings: Record<string, unknown> = {};
  if (typeof findingsRaw === "string" && findingsRaw) {
    try {
      findings = JSON.parse(findingsRaw) as Record<string, unknown>;
    } catch {
      return c.json({ error: "Invalid findings JSON" }, 400);
    }
  }

  if (!summary) {
    return c.json({ error: "summary is required" }, 400);
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return c.json({ error: "photo file is required" }, 400);
  }

  const existing = await sql`
    SELECT id FROM reports WHERE assignment_id = ${assignmentId}::uuid
  `;
  if (existing.length > 0) {
    return c.json({ error: "Report already submitted" }, 409);
  }

  const reportRows = await sql`
    INSERT INTO reports (assignment_id, summary, findings)
    VALUES (${assignmentId}::uuid, ${summary}, ${JSON.stringify(findings)}::jsonb)
    RETURNING id, summary, findings, submitted_at
  `;
  const report = reportRows[0] as { id: string };

  const ext = photo.type === "image/png" ? "png" : "jpg";
  const r2Key = `reports/${report.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await photo.arrayBuffer());
  await c.env.REPORT_PHOTOS.put(r2Key, bytes, {
    httpMetadata: { contentType: photo.type || "image/jpeg" },
  });

  await sql`
    INSERT INTO report_photos (report_id, r2_key, content_type, byte_size)
    VALUES (
      ${report.id}::uuid,
      ${r2Key},
      ${photo.type || "image/jpeg"},
      ${bytes.byteLength}
    )
  `;

  await sql`
    UPDATE mission_assignments
    SET status = 'submitted'::assignment_status
    WHERE id = ${assignmentId}::uuid
  `;
  await sql`
    UPDATE missions
    SET status = 'completed'::mission_status, updated_at = now()
    WHERE id = ${assignment.mission_id}::uuid
  `;

  return c.json(
    {
      report: {
        ...reportRows[0],
        missionId: assignment.mission_id,
      },
    },
    201,
  );
});

export default assignments;
