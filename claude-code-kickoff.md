# Frame Perfect — Claude Code + Supabase kickoff

This is the spec for rebuilding the Frame Perfect prototype (Geometry Dash
list-building app) with a real backend. Hand this whole file to Claude Code
as your first prompt.

## Stack recommendation
- **Next.js** (App Router) + **Supabase** (Postgres + Auth + Storage)
- Supabase JS client for data, Supabase Auth for real accounts
- Deploy to **Vercel** (free tier is fine to start)

## What already exists
- `supabase-schema.sql` in this same folder — the full database schema and
  RLS policies. Run this as your first Supabase migration.
- `frame-perfect.html` — the original prototype. It's a single-file
  browser app with no real backend, but every screen, button, and flow in
  it is the exact behavior to replicate. Treat it as the UI/UX reference.

## Feature list to rebuild

**Auth**
- Sign up / log in with username + password (use Supabase Auth; store the
  chosen username in `profiles`)
- Admin account with elevated access (see Admin section — do NOT hardcode
  admin credentials in client code this time; use a real role check)

**Lists**
- Any user can create a list: name, target size (number of ranked slots),
  rules text (shown to submitters), and points configuration
- List owner (and optionally invited "editors") can edit list settings,
  add/edit/remove levels, reorder by drag, review submitted records

**Levels**
- Fields: name, difficulty (Easy → Extreme Demon, 10 tiers), verifier,
  publisher, points, position, image
- Adding a level requires a position; out-of-range positions auto-clamp
  (e.g. inserting at #8 on a 3-level list places it at #4)
- A list's moderator cannot be the verifier of their own levels — that
  needs a separate account
- When a new level pushes the list past its target size, the lowest-ranked
  level is automatically archived to the Legacy List (see below)

**Points configuration**
- Two modes, moderator-selectable:
  - **Level-locked**: each level keeps its own fixed point value
  - **Rank-locked**: points are assigned per rank slot (#1, #2, ...) —
    whichever level currently holds that rank earns that value
- **Autofill** for rank-locked mode: moderator enters a points value for
  #1 and for the last rank, picks Linear or Exponential (geometric decay,
  recommended default), and the ranks in between get interpolated
  automatically
- Points must always be **derived live**, never cached — if a level's
  points (or its rank's points) change, every victor's and the verifier's
  total should reflect that immediately with no manual recalculation step

**Records (victor / verifier submissions)**
- Any non-owner can submit a record against a list: optional video link,
  then either:
  - **Victor**: pick an existing level from the list
  - **Verifier**: type a new level name + pick its difficulty
- Records land in the moderator's Record Feed as "pending"
- Moderator can **Accept** or **Decline** (with a written reason) each one
- Accepting a **victor** record adds that player to the level's victor
  list (kept hidden from other players — only the *count* is public) and
  they're credited the level's current points
- Accepting a **verifier** record requires the moderator to manually add
  the level (pre-filled with the submitted name/difficulty/verifier) —
  once saved, the verifier is credited that level's points

**Legacy List**
- Archive of levels once on the main list, now pushed off
- Shows each level's highest rank ever reached, which level's addition
  pushed it off, and its own rank within the legacy archive (ordered by
  best rank reached)
- Deliberately plain/understated styling — not meant to be as visually
  loud as the main list

**Stats Viewer**
- Leaderboard of every player with points on a list, ranked, with a
  search bar
- Click a player to see their full breakdown: Victories and
  Verifications, each level with its difficulty and points

**Read-only browsing**
- Non-owners can search for and open any list without a password, in a
  read-only view (no edit controls). A player's own point total for that
  list shows automatically at the top, along with "X / Y levels
  completed" for their own victor count

**Admin**
- Manage Accounts: search, multi-select checkboxes, delete
- View As: enter any user's account read-only to look around (no write
  access at all — this should be enforced server-side via RLS/role
  checks, not just hidden buttons in the UI)
- Testing sandbox: create passwordless "TesterN" accounts, rename them,
  and enter them with full read/write access — but fully isolated from
  real users' data (separate flag or schema, not just a different UI
  path)

## Notes from building the prototype (avoid repeating these mistakes)
- Native `confirm()`/`alert()` dialogs don't work in sandboxed iframe
  previews — not relevant once this has its own domain, but worth a
  reminder to always build a real confirmation UI instead of relying on
  browser dialogs, since it's just better UX anyway.
- Don't store a running point total that gets incremented on each accept
  — derive it live from victor/verifier assignments so editing a level's
  points retroactively updates everyone's total for free.
- The "list password" mechanic from the prototype was a workaround for
  not having real accounts. Now that Supabase Auth exists, replace it
  with the `list_editors` table in the schema — invite specific accounts
  as editors instead of sharing a password.

## First prompt to paste into Claude Code

> Read supabase-schema.sql and claude-code-kickoff.md in this folder.
> Scaffold a Next.js + Supabase app implementing everything described.
> Start with: Supabase project connection, the auth flow (sign up/log
> in), and the dashboard + list creation screen. Reference
> frame-perfect.html for exact UI/UX behavior on each screen as you
> build it out. Ask me before running any destructive database
> operations.
