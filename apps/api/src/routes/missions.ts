import { Hono } from "hono";
import type { Bindings, Variables, MissionType } from "../types";
import { authMiddleware, requireRole } from "../middleware/auth";
import { getSql } from "../db";

const missions = new Hono<{ Bindings: Bindings; Variables: Variables }>();

missions.use("*", authMiddleware);

missions.post("/", requireRole("business"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    title: string;
    description?: string;
    missionType?: MissionType;
    location?: string;
    paymentCents: number;
    minSpecialistLevel?: number;
  }>();

  if (!body.title || body.paymentCents == null) {
    return c.json({ error: "title and paymentCents are required" }, 400);
  }

  const sql = getSql(c.env);
  const biz = await sql`
    SELECT id FROM businesses WHERE user_id = ${user.id}::uuid
  `;
  if (biz.length === 0) {
    return c.json({ error: "Business profile missing" }, 400);
  }

  const businessId = (biz[0] as { id: string }).id;
  const minLevel = Math.min(5, Math.max(1, body.minSpecialistLevel ?? 1));
  const missionType = body.missionType ?? "custom";

  const created = await sql`
    INSERT INTO missions (
      business_id, title, description, mission_type, location,
      payment_cents, min_specialist_level, status
    ) VALUES (
      ${businessId}::uuid,
      ${body.title},
      ${body.description ?? ""},
      ${missionType}::mission_type,
      ${body.location ?? null},
      ${body.paymentCents},
      ${minLevel},
      'open'::mission_status
    )
    RETURNING id, title, description, mission_type, location, payment_cents,
      min_specialist_level, status, created_at
  `;

  return c.json({ mission: mapMission(created[0]) }, 201);
});

missions.get("/mine", requireRole("business"), async (c) => {
  const user = c.get("user");
  const sql = getSql(c.env);
  const rows = await sql`
    SELECT m.id, m.title, m.description, m.mission_type, m.location,
      m.payment_cents, m.min_specialist_level, m.status, m.created_at
    FROM missions m
    JOIN businesses b ON b.id = m.business_id
    WHERE b.user_id = ${user.id}::uuid
    ORDER BY m.created_at DESC
  `;
  return c.json({ missions: rows.map(mapMission) });
});

missions.get("/available", requireRole("specialist"), async (c) => {
  const user = c.get("user");
  const sql = getSql(c.env);
  const spec = await sql`
    SELECT id, level FROM specialists WHERE user_id = ${user.id}::uuid
  `;
  if (spec.length === 0) {
    return c.json({ error: "Specialist profile missing" }, 400);
  }
  const { id: specialistId, level } = spec[0] as {
    id: string;
    level: number;
  };

  const rows = await sql`
    SELECT m.id, m.title, m.description, m.mission_type, m.location,
      m.payment_cents, m.min_specialist_level, m.status, m.created_at,
      b.name AS business_name
    FROM missions m
    JOIN businesses b ON b.id = m.business_id
    WHERE m.status = 'open'::mission_status
      AND m.min_specialist_level <= ${level}
      AND NOT EXISTS (
        SELECT 1 FROM mission_assignments ma WHERE ma.mission_id = m.id
      )
    ORDER BY m.created_at DESC
  `;

  return c.json({
    specialistId,
    missions: rows.map((r) => ({
      ...mapMission(r),
      businessName: (r as { business_name: string }).business_name,
    })),
  });
});

missions.post("/:id/accept", requireRole("specialist"), async (c) => {
  const missionId = c.req.param("id");
  const user = c.get("user");
  const sql = getSql(c.env);

  const spec = await sql`
    SELECT id, level FROM specialists WHERE user_id = ${user.id}::uuid
  `;
  if (spec.length === 0) {
    return c.json({ error: "Specialist profile missing" }, 400);
  }
  const specialist = spec[0] as { id: string; level: number };

  const missionRows = await sql`
    SELECT id, min_specialist_level, status FROM missions WHERE id = ${missionId}::uuid
  `;
  if (missionRows.length === 0) {
    return c.json({ error: "Mission not found" }, 404);
  }
  const mission = missionRows[0] as {
    id: string;
    min_specialist_level: number;
    status: string;
  };

  if (mission.status !== "open") {
    return c.json({ error: "Mission is not open" }, 409);
  }
  if (specialist.level < mission.min_specialist_level) {
    return c.json({ error: "Specialist level too low" }, 403);
  }

  try {
    const assignment = await sql`
      INSERT INTO mission_assignments (mission_id, specialist_id, status)
      VALUES (${missionId}::uuid, ${specialist.id}::uuid, 'accepted'::assignment_status)
      RETURNING id, mission_id, specialist_id, status, accepted_at
    `;
    await sql`
      UPDATE missions SET status = 'assigned'::mission_status, updated_at = now()
      WHERE id = ${missionId}::uuid
    `;
    return c.json({ assignment: assignment[0] }, 201);
  } catch {
    return c.json({ error: "Mission already assigned" }, 409);
  }
});

missions.get("/:id/report", requireRole("business"), async (c) => {
  const missionId = c.req.param("id");
  const user = c.get("user");
  const sql = getSql(c.env);

  const access = await sql`
    SELECT m.id
    FROM missions m
    JOIN businesses b ON b.id = m.business_id
    WHERE m.id = ${missionId}::uuid AND b.user_id = ${user.id}::uuid
  `;
  if (access.length === 0) {
    return c.json({ error: "Mission not found" }, 404);
  }

  const reportRows = await sql`
    SELECT r.id, r.summary, r.findings, r.submitted_at,
      ma.id AS assignment_id, ma.status AS assignment_status
    FROM mission_assignments ma
    JOIN reports r ON r.assignment_id = ma.id
    WHERE ma.mission_id = ${missionId}::uuid
  `;

  if (reportRows.length === 0) {
    return c.json({ error: "No report submitted yet" }, 404);
  }

  const report = reportRows[0] as {
    id: string;
    summary: string;
    findings: unknown;
    submitted_at: string;
    assignment_id: string;
    assignment_status: string;
  };

  const photos = await sql`
    SELECT id, r2_key, content_type, byte_size, created_at
    FROM report_photos WHERE report_id = ${report.id}::uuid
  `;

  return c.json({
    report: {
      id: report.id,
      summary: report.summary,
      findings: report.findings,
      submittedAt: report.submitted_at,
      assignmentId: report.assignment_id,
      assignmentStatus: report.assignment_status,
      photos: photos.map((p) => ({
        id: (p as { id: string }).id,
        key: (p as { r2_key: string }).r2_key,
        contentType: (p as { content_type: string }).content_type,
        byteSize: (p as { byte_size: number | null }).byte_size,
        url: `/reports/photos/${(p as { id: string }).id}`,
      })),
    },
  });
});

function mapMission(row: unknown) {
  const r = row as Record<string, unknown>;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    missionType: r.mission_type,
    location: r.location,
    paymentCents: r.payment_cents,
    minSpecialistLevel: r.min_specialist_level,
    status: r.status,
    createdAt: r.created_at,
  };
}

export default missions;
