import { query, isDatabaseConfigured } from "./pool";
import {
  createSessionToken,
  hashPassword,
  normalizeUsername,
  sessionExpiry,
  verifyPassword,
} from "../auth";

export interface Account {
  id: string;
  username: string;
  email: string | null;
}

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
}

export class AccountsUnavailableError extends Error {
  constructor() {
    super("Accounts need a database. Set DATABASE_URL to enable sign in.");
  }
}

function requireDatabase(): void {
  if (!isDatabaseConfigured()) throw new AccountsUnavailableError();
}

function toAccount(row: UserRow): Account {
  return { id: row.id, username: row.username, email: row.email };
}

export async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  requireDatabase();
  const result = await query<UserRow>(
    `SELECT id, username, email, password_hash FROM users WHERE username_key = $1`,
    [normalizeUsername(username)]
  );
  return result.rows[0];
}

/**
 * True when this profile id is free to become an account — i.e. it is the guest
 * profile the browser has been using and no account already owns it.
 */
async function isClaimableProfile(profileId: string): Promise<boolean> {
  const owned = await query(`SELECT 1 FROM users WHERE id = $1`, [profileId]);
  if (owned.rowCount) return false;
  const exists = await query(`SELECT 1 FROM user_profiles WHERE id = $1`, [profileId]);
  return !!exists.rowCount;
}

export async function createAccount(input: {
  username: string;
  password: string;
  email?: string | null;
  guestId?: string | null;
}): Promise<Account> {
  requireDatabase();

  const existing = await findUserByUsername(input.username);
  if (existing) throw new Error("That username is already taken");

  // Reuse the guest profile id so every food plan, template and taste signal
  // already stored against it belongs to the new account with nothing copied.
  const guestId = input.guestId?.trim();
  const claimable = guestId ? await isClaimableProfile(guestId) : false;
  const id = claimable && guestId ? guestId : `user-${Date.now()}-${createSessionToken().slice(0, 6)}`;

  const username = input.username.trim();
  const email = input.email?.trim() || null;
  const passwordHash = await hashPassword(input.password);

  await query(
    `INSERT INTO user_profiles (id, username) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()`,
    [id, username]
  );
  await query(
    `INSERT INTO users (id, username, username_key, email, password_hash)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, username, normalizeUsername(username), email, passwordHash]
  );

  return { id, username, email };
}

export async function authenticate(username: string, password: string): Promise<Account | null> {
  requireDatabase();
  const row = await findUserByUsername(username);
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash);
  return ok ? toAccount(row) : null;
}

export async function startSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  requireDatabase();
  const token = createSessionToken();
  const expiresAt = sessionExpiry();
  await query(`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`, [
    token,
    userId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function accountForSession(token: string | undefined): Promise<Account | null> {
  if (!token || !isDatabaseConfigured()) return null;
  const result = await query<UserRow>(
    `SELECT u.id, u.username, u.email, u.password_hash
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  const row = result.rows[0];
  return row ? toAccount(row) : null;
}

export async function endSession(token: string | undefined): Promise<void> {
  if (!token || !isDatabaseConfigured()) return;
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
}
