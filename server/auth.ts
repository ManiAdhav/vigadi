import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const BCRYPT_ROUNDS = 10;
const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/** 30 days, in milliseconds. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "vigadi_session";

/** Lookup key for a username — case and padding never decide who you are. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Returns the one thing wrong with these credentials, or null when they are usable. */
export function validateCredentials(username: string, password: string): string | null {
  const trimmed = username.trim();
  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters`;
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return "Username can only use letters, numbers, dots, dashes and underscores";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_MS);
}
