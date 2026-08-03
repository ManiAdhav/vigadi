import { describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeUsername,
  validateCredentials,
  verifyPassword,
} from "../auth";

describe("validateCredentials", () => {
  it("accepts a normal username and password", () => {
    expect(validateCredentials("mani", "supersecret")).toBeNull();
  });

  it("rejects a short password with a message a person can act on", () => {
    expect(validateCredentials("mani", "short")).toBe(
      "Password must be at least 8 characters"
    );
  });

  it("rejects a blank or too-short username", () => {
    expect(validateCredentials("  ", "supersecret")).toBe(
      "Username must be at least 3 characters"
    );
    expect(validateCredentials("ab", "supersecret")).toBe(
      "Username must be at least 3 characters"
    );
  });

  it("rejects usernames with characters that would break lookups", () => {
    expect(validateCredentials("ma ni", "supersecret")).toBe(
      "Username can only use letters, numbers, dots, dashes and underscores"
    );
  });
});

describe("normalizeUsername", () => {
  it("matches usernames regardless of case or padding", () => {
    expect(normalizeUsername("  Mani  ")).toBe("mani");
    expect(normalizeUsername("MANI")).toBe(normalizeUsername("mani"));
  });
});

describe("password hashing", () => {
  it("never stores the password in readable form", async () => {
    const hash = await hashPassword("supersecret");
    expect(hash).not.toContain("supersecret");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("accepts the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("supersecret");
    expect(await verifyPassword("supersecret", hash)).toBe(true);
    expect(await verifyPassword("Supersecret", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("produces a different hash each time for the same password", async () => {
    expect(await hashPassword("supersecret")).not.toBe(await hashPassword("supersecret"));
  });
});
