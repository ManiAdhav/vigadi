# Accounts & Food Plan Persistence — Design

**Date:** 2026-08-03
**Status:** Approved
**Scope:** Project A of two. Project B (user preference summary + fallback meal suggestion) is a separate spec.

## Problem

A food plan built in the app never reaches the database.

Evidence gathered before designing:

- The live Postgres has 8 `user_profiles` rows. **Every one has `food_plates = 0`.** Not one plan has ever been saved.
- The API is not at fault: `POST /api/food-plates/:userId` followed by `GET` round-trips a plate correctly against the same database.
- The failure is in `FoodPlateBuilder`. `blankPlate()` leaves `name: ""`, and the Save button is disabled while the name is empty
  (`FoodPlateBuilder.tsx:357`). The name input's placeholder is `Balanced Lunch` — grey text that reads like a value already
  entered. Every other field is pre-filled and a live preview renders `Plain Rice + Curry + Side + Kulambu`.

  Confirmed in-browser: `{ saveDisabled: true, nameValue: "", namePlaceholder: "Balanced Lunch" }`.

  So the form looks complete, Save is inert, and nothing explains why.

A second, independent problem: identity is a throwaway `user-${Date.now()}` written to localStorage, minted separately in
`ProfileView.tsx:15` and `KitchenView.tsx:35`. Clearing the browser or switching device produces a brand-new empty user. This is
why 8 anonymous rows exist for one person.

## Part 1 — Make Save work

1. `blankPlate()` sets `name: "Balanced Lunch"` — a real default value, editable, not a placeholder that lies.
2. The Save button is **never disabled**. On click, validation runs and reports the specific problem inline:
   - empty name → "Give this plan a name"
   - no dishes → "Add at least one dish"
   - no days → "Pick at least one day"
3. On success the sheet returns to the list and the new plan is visible there.

The existing server-side validation in `server.ts` stays as the backstop and is unchanged.

## Part 2 — Accounts

Login is **optional**. Guest mode continues to work exactly as today; the app never shows a wall.

### Data

New `users` table (migration `008_users.sql`):

| column | notes |
|---|---|
| `id` | text PK — **same value as `user_profiles.id`** |
| `username` | text, unique, case-insensitive |
| `email` | text, nullable, no verification |
| `password_hash` | bcrypt |
| `created_at` | timestamptz |

New `sessions` table: `token` (PK, random 32-byte hex), `user_id`, `created_at`, `expires_at` (30 days).

**Key decision:** the account id *is* the profile id. Food plans, meal templates and taste profile already hang off
`user_profiles.id`, so signing up while holding guest data claims that existing profile row rather than copying anything.
Nothing the user built as a guest is lost.

### Endpoints

- `POST /api/auth/signup` — `{ username, password, email?, guestId? }`. Rejects duplicate username (409) and passwords under 8
  characters (400). If `guestId` names an existing profile row that no account owns, that row becomes the account's profile.
- `POST /api/auth/login` — `{ username, password }`. 401 on bad credentials, with the same message for unknown username and wrong
  password.
- `POST /api/auth/logout` — deletes the session.
- `GET /api/auth/me` — returns `{ user: { id, username, email } | null }`.

Session travels in an **httpOnly, sameSite=lax cookie** (`vigadi_session`), `secure` in production. No session value is readable
from JavaScript.

### Frontend

- One `useUser()` hook replaces both copies of `getUserId()`. It returns the logged-in id when a session exists, otherwise the
  localStorage guest id, and exposes `signup`, `login`, `logout`.
- Profile gains an account block: signed out shows "Save your plan — create account / log in"; signed in shows the username and a
  Log out button.
- `ProfileView` and `KitchenView` consume the hook instead of minting ids.

## Out of scope

Password reset UI (reset is done directly in the database, which is why the email field exists), email verification, multi-device
conflict handling, and all of Project B.

## Testing

Automated (vitest, `server/__tests__/`):

- a food plate whose name was never edited still saves and reads back
- duplicate username rejected
- login with the wrong password rejected
- password is stored hashed, never in clear text
- signup with a `guestId` claims that profile, and its food plates survive

Manual acceptance: build a plan → log out → log in from a clean browser profile → the plan is there.
