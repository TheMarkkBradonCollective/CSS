import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, validatePassword } from "../src/auth/password";

describe("password hashing", () => {
  it("validates minimum length", () => {
    expect(validatePassword("short")).toMatch(/8 characters/);
    expect(validatePassword("longenough")).toBeNull();
  });

  it("hashes and verifies with PBKDF2", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
});
