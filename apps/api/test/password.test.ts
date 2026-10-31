import { describe, expect, it } from "vitest";
import {
  PBKDF2_ITERATIONS,
  WORKERS_PBKDF2_MAX_ITERATIONS,
  hashPassword,
  verifyPassword,
  validatePassword,
} from "../src/auth/password";

describe("password hashing", () => {
  it("uses PBKDF2 iterations within Cloudflare Workers limit", () => {
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(WORKERS_PBKDF2_MAX_ITERATIONS);
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000);
  });

  it("validates minimum length", () => {
    expect(validatePassword("short")).toMatch(/8 characters/);
    expect(validatePassword("longenough")).toBeNull();
  });

  it("hashes and verifies with PBKDF2", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("pbkdf2-sha256$")).toBe(true);
    const embeddedIterations = Number(stored.split("$")[1]);
    expect(embeddedIterations).toBe(PBKDF2_ITERATIONS);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
});
