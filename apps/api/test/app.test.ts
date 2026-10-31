import { describe, expect, it } from "vitest";
import app from "../src/index";

describe("CSS API", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health", {}, {
      DATABASE_URL: "postgres://example",
      REPORT_PHOTOS: {} as R2Bucket,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("OPTIONS preflight returns 204", async () => {
    const res = await app.request(
      "/missions/available",
      { method: "OPTIONS", headers: { Origin: "http://localhost:5173" } },
      {
        DATABASE_URL: "postgres://example",
        REPORT_PHOTOS: {} as R2Bucket,
      },
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
  });

  it("protected route rejects missing auth", async () => {
    const res = await app.request("/missions/mine", {}, {
      DATABASE_URL: "postgres://example",
      REPORT_PHOTOS: {} as R2Bucket,
    });
    expect(res.status).toBe(401);
  });
});
