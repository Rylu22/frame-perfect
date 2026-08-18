-- ============================================================
-- FRAME PERFECT — Supabase schema
-- Mirrors the feature set of the claude.ai prototype:
-- accounts, lists, levels, records (victor/verifier), points
-- (level-locked or rank-locked), legacy list, admin.
-- ============================================================

-- ---------- profiles (extends Supabase Auth) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- lists ----------
create table lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  target_size int not null check (target_size > 0),
  rules text default '',
  points_mode text not null default 'level' check (points_mode in ('level','rank')),
  rank_points jsonb not null default '{}',  -- { "1": 100.00, "2": 90.00, ... }
  created_at timestamptz not null default now()
);

-- Optional: separate editors who can manage a list without being the owner.
-- Replaces the prototype's "list password" — a real app should use real
-- authorization instead of a second shared secret.
create table list_editors (
  list_id uuid references lists(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (list_id, user_id)
);

-- ---------- levels (the main list) ----------
create table levels (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  name text not null,
  difficulty text not null check (difficulty in
    ('easy','normal','hard','harder','insane',
     'demon-easy','demon-medium','demon-hard','demon-insane','demon-extreme')),
  verifier_id uuid references profiles(id),
  publisher text default '',
  points numeric(10,2) not null default 0,   -- used when points_mode = 'level'
  position int not null,
  image_url text,
  best_rank int not null,                     -- tracks all-time best position
  created_at timestamptz not null default now(),
  unique (list_id, position)
);

create table level_victors (
  level_id uuid references levels(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (level_id, user_id)
);

-- ---------- legacy list (levels pushed off the main list) ----------
create table legacy_levels (
  id uuid primary key default gen_random_uuid(),  -- same id as the original level
  list_id uuid not null references lists(id) on delete cascade,
  name text not null,
  difficulty text,
  verifier_id uuid references profiles(id),
  publisher text default '',
  points numeric(10,2) not null default 0,   -- frozen at the moment it fell off
  best_rank int not null,
  pushed_off_by text,                        -- name of the level that displaced it
  fell_off_at timestamptz not null default now()
);

create table legacy_victors (
  legacy_level_id uuid references legacy_levels(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (legacy_level_id, user_id)
);

-- ---------- records (victor / verifier submissions) ----------
create table records (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  type text not null check (type in ('victor','verifier')),
  level_id uuid references levels(id),        -- set for victor records
  level_name text,                            -- set for verifier records (level doesn't exist yet)
  difficulty text,                            -- set for verifier records
  video_url text,                             -- optional
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  decline_reason text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table lists enable row level security;
alter table list_editors enable row level security;
alter table levels enable row level security;
alter table level_victors enable row level security;
alter table legacy_levels enable row level security;
alter table legacy_victors enable row level security;
alter table records enable row level security;

-- profiles: anyone signed in can look people up (verifier autocomplete, victor names);
-- only the owner can edit their own row.
create policy "profiles are readable by authenticated users"
  on profiles for select using (auth.role() = 'authenticated');
create policy "users manage their own profile"
  on profiles for update using (auth.uid() = id);

-- lists: readable by everyone (public list browsing); only the owner (or an
-- editor) can create/update/delete.
create policy "lists are publicly readable"
  on lists for select using (true);
create policy "owners create lists"
  on lists for insert with check (auth.uid() = owner_id);
create policy "owners and editors update lists"
  on lists for update using (
    auth.uid() = owner_id
    or exists (select 1 from list_editors e where e.list_id = id and e.user_id = auth.uid())
  );
create policy "owners delete lists"
  on lists for delete using (auth.uid() = owner_id);

-- levels: readable by everyone; writable by the list's owner/editors.
create policy "levels are publicly readable"
  on levels for select using (true);
create policy "owners and editors manage levels"
  on levels for all using (
    exists (
      select 1 from lists l
      where l.id = list_id
      and (l.owner_id = auth.uid()
           or exists (select 1 from list_editors e where e.list_id = l.id and e.user_id = auth.uid()))
    )
  );

-- level_victors: readable by everyone (drives the public victor COUNT);
-- only ever written by a server-side function (see accept_victor_record below),
-- never directly by a client, to keep the award flow trustworthy.
create policy "victors are publicly readable"
  on level_victors for select using (true);

-- legacy tables: read-only to everyone, written only by the trigger that
-- pushes a level off the main list (see below).
create policy "legacy levels are publicly readable"
  on legacy_levels for select using (true);
create policy "legacy victors are publicly readable"
  on legacy_victors for select using (true);

-- records: anyone signed in can submit (except onto their own list — enforce
-- in application code or a check constraint using a function); the submitter
-- can see their own records, and the list owner/editors can see and act on all.
create policy "submitters see their own records"
  on records for select using (auth.uid() = submitted_by);
create policy "owners and editors see all records for their list"
  on records for select using (
    exists (
      select 1 from lists l
      where l.id = list_id
      and (l.owner_id = auth.uid()
           or exists (select 1 from list_editors e where e.list_id = l.id and e.user_id = auth.uid()))
    )
  );
create policy "authenticated users submit records"
  on records for insert with check (auth.uid() = submitted_by);
create policy "owners and editors update record status"
  on records for update using (
    exists (
      select 1 from lists l
      where l.id = list_id
      and (l.owner_id = auth.uid()
           or exists (select 1 from list_editors e where e.list_id = l.id and e.user_id = auth.uid()))
    )
  );

-- ============================================================
-- SERVER-SIDE LOGIC (Postgres functions / triggers)
-- Ask Claude Code to implement these — don't let the client award
-- points or victor credit directly, or anyone could grant it to themselves.
-- ============================================================

-- accept_victor_record(record_id uuid)
--   - validates caller is the list owner/editor
--   - inserts into level_victors
--   - marks the record 'accepted'
--   - runs as SECURITY DEFINER so level_victors stays client-writeproof

-- accept_verifier_record(record_id uuid, level_data jsonb)
--   - validates caller is the list owner/editor
--   - inserts the new level (with verifier_id = record.submitted_by)
--   - marks the record 'accepted'

-- push_level_to_legacy(list_id uuid)
--   - trigger (or function called after insert on levels) that checks
--     count(levels) > target_size, and if so, moves the lowest-ranked
--     level (and its level_victors rows) into legacy_levels / legacy_victors

-- get_list_points(list_id uuid)
--   - a VIEW or function that derives each player's total points live:
--     sum of (level.points or rank_points[level.position]) for every level
--     where they're a victor or the verifier, across both levels and
--     legacy_levels. This is what keeps points auto-updating when a
--     level's point value or rank changes — don't store a cached total.

-- ============================================================
-- USERNAME-ONLY AUTH SUPPORT (added for the Next.js + Supabase rebuild)
-- Supabase Auth requires an email; the app derives a stable, non-routable
-- one from the username client-side (see src/lib/auth.ts) and never shows
-- it to the user. This trigger creates the matching `profiles` row the
-- moment `auth.users` gets a new row, using the username passed in
-- `options.data.username` at signUp — so profile creation can't be
-- skipped or forged by a client that talks to `profiles` directly.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- LEVEL BUILDER SUPPORT (added for the list-builder rebuild)
-- All four functions run as SECURITY INVOKER (the caller's own privileges),
-- so the existing "owners and editors manage levels" RLS policy is what
-- actually authorizes these calls — a non-owner calling them just hits a
-- row-level-security error, same as a raw INSERT/UPDATE/DELETE would.
--
-- The "+100000, then -100000 (+/-1)" two-step updates below are a standard
-- way to bulk-shift a column with a UNIQUE constraint (list_id, position)
-- without transient collisions: Postgres checks uniqueness per row as a
-- statement executes, so shifting several rows into each other's old slots
-- in one UPDATE can fail depending on row processing order. Moving them
-- out of the whole occupied range first, then back in, sidesteps that.
-- ============================================================

-- A list's moderator can never be credited as a level's verifier — that
-- requires a separate account. Enforced here (not just in the client) so
-- it holds regardless of how a row gets written.
create or replace function public.check_verifier_not_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  if new.verifier_id is not null then
    select owner_id into v_owner from lists where id = new.list_id;
    if v_owner = new.verifier_id then
      raise exception 'The list moderator cannot be the verifier of their own level.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists levels_verifier_not_owner on levels;
create trigger levels_verifier_not_owner
  before insert or update on levels
  for each row execute function public.check_verifier_not_owner();

-- add_level: inserts a level at a (clamped) position, shifting everything
-- at/after it down by one. If that pushes the list past its target size,
-- the now-lowest-ranked level is archived into legacy_levels/legacy_victors.
create or replace function public.add_level(
  p_list_id uuid,
  p_position int,
  p_name text,
  p_difficulty text,
  p_verifier_id uuid,
  p_publisher text,
  p_points numeric,
  p_image_url text
) returns levels
language plpgsql
security invoker
as $$
declare
  v_count int;
  v_target_size int;
  v_clamped_pos int;
  v_new_level levels;
  v_pushed_id uuid;
begin
  select count(*) into v_count from levels where list_id = p_list_id;
  select target_size into v_target_size from lists where id = p_list_id;
  if v_target_size is null then
    raise exception 'list not found';
  end if;

  v_clamped_pos := greatest(1, least(coalesce(p_position, v_count + 1), v_count + 1));

  update levels set position = position + 100000
    where list_id = p_list_id and position >= v_clamped_pos;
  update levels set position = position - 100000 + 1
    where list_id = p_list_id and position >= 100000;

  insert into levels (list_id, name, difficulty, verifier_id, publisher, points, position, image_url, best_rank)
  values (p_list_id, p_name, p_difficulty, p_verifier_id, p_publisher, p_points, v_clamped_pos, p_image_url, v_clamped_pos)
  returning * into v_new_level;

  select count(*) into v_count from levels where list_id = p_list_id;
  if v_count > v_target_size then
    select id into v_pushed_id from levels where list_id = p_list_id order by position desc limit 1;

    insert into legacy_levels (id, list_id, name, difficulty, verifier_id, publisher, points, best_rank, pushed_off_by)
    select id, list_id, name, difficulty, verifier_id, publisher, points, best_rank, p_name
    from levels where id = v_pushed_id;

    insert into legacy_victors (legacy_level_id, user_id)
    select level_id, user_id from level_victors where level_id = v_pushed_id;

    delete from levels where id = v_pushed_id;
  end if;

  return v_new_level;
end;
$$;

-- update_level: edits a level's fields and, if its position changed,
-- shifts only the levels between its old and new slot.
--
-- Bug fixed here: the shift used to run before the edited row moved out
-- of its own old slot, so a level being shifted into that slot collided
-- with the edited row still sitting there — e.g. moving C from #3 to #1
-- in [A#1,B#2,C#3] shifts B from #2 to #3, but C hasn't left #3 yet, so
-- two rows both claim #3 and the UNIQUE(list_id, position) constraint
-- rejects the whole update. Parking the edited row at position -1 first
-- (outside any valid range) guarantees the shift can never land on it.
create or replace function public.update_level(
  p_level_id uuid,
  p_position int,
  p_name text,
  p_difficulty text,
  p_verifier_id uuid,
  p_publisher text,
  p_points numeric,
  p_image_url text
) returns levels
language plpgsql
security invoker
as $$
declare
  v_list_id uuid;
  v_old_pos int;
  v_count int;
  v_clamped_pos int;
  v_updated levels;
begin
  select list_id, position into v_list_id, v_old_pos from levels where id = p_level_id;
  if v_list_id is null then
    raise exception 'level not found';
  end if;

  select count(*) into v_count from levels where list_id = v_list_id and id <> p_level_id;
  v_clamped_pos := greatest(1, least(coalesce(p_position, v_old_pos), v_count + 1));

  if v_clamped_pos <> v_old_pos then
    update levels set position = -1 where id = p_level_id;

    if v_clamped_pos < v_old_pos then
      update levels set position = position + 100000
        where list_id = v_list_id and position >= v_clamped_pos and position < v_old_pos;
      update levels set position = position - 100000 + 1
        where list_id = v_list_id and position >= 100000;
    else
      update levels set position = position + 100000
        where list_id = v_list_id and position > v_old_pos and position <= v_clamped_pos;
      update levels set position = position - 100000 - 1
        where list_id = v_list_id and position >= 100000;
    end if;
  end if;

  update levels
    set name = p_name,
        difficulty = p_difficulty,
        verifier_id = p_verifier_id,
        publisher = p_publisher,
        points = p_points,
        position = v_clamped_pos,
        image_url = p_image_url,
        best_rank = least(best_rank, v_clamped_pos)
    where id = p_level_id
    returning * into v_updated;

  return v_updated;
end;
$$;

-- delete_level: removes a level and closes the position gap it leaves.
-- A manual delete never archives to the legacy list — only add_level's
-- target-size overflow does that.
create or replace function public.delete_level(p_level_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_list_id uuid;
  v_position int;
begin
  select list_id, position into v_list_id, v_position from levels where id = p_level_id;
  if v_list_id is null then
    return;
  end if;

  delete from levels where id = p_level_id;

  update levels set position = position + 100000
    where list_id = v_list_id and position > v_position;
  update levels set position = position - 100000 - 1
    where list_id = v_list_id and position >= 100000;
end;
$$;

-- reorder_levels: applied after a drag-and-drop reorder on the client —
-- takes the full new ordering as an array of level ids and reassigns
-- positions 1..N to match, updating best_rank for any level whose
-- position just improved.
create or replace function public.reorder_levels(p_list_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_pos int;
begin
  if (select count(*) from levels where list_id = p_list_id) <> coalesce(array_length(p_ordered_ids, 1), 0) then
    raise exception 'ordered_ids does not match the list''s level count';
  end if;

  update levels set position = position + 100000 where list_id = p_list_id;

  v_pos := 1;
  foreach v_id in array p_ordered_ids loop
    update levels
      set position = v_pos,
          best_rank = least(best_rank, v_pos)
      where id = v_id and list_id = p_list_id;
    v_pos := v_pos + 1;
  end loop;
end;
$$;

-- ============================================================
-- RECORDS + EDITORS SUPPORT (added for the records/points/settings rebuild)
-- ============================================================

-- list_editors had RLS enabled from the start but was never given any
-- policies, which under RLS's default-deny means nobody — not even the
-- list owner — could read or write it. This was a gap in the original
-- schema; the "invite an editor" feature in Settings needs these.
create policy "list editors are readable by authenticated users"
  on list_editors for select using (auth.role() = 'authenticated');
create policy "list owners manage editors"
  on list_editors for all using (
    exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid())
  ) with check (
    exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid())
  );

-- A list's own owner can't submit a record to it (there'd be no one left
-- to moderate the review). The submit-record page already hides itself
-- from owners, but this holds regardless of how a row gets written.
create or replace function public.check_record_not_from_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from lists where id = new.list_id;
  if v_owner = new.submitted_by then
    raise exception 'The list owner cannot submit a record to their own list.';
  end if;
  return new;
end;
$$;

drop trigger if exists records_not_from_owner on records;
create trigger records_not_from_owner
  before insert on records
  for each row execute function public.check_record_not_from_owner();

-- accept_victor_record: the only path allowed to write level_victors (see
-- the "victors are publicly readable" policy's comment above — there is no
-- client insert policy on that table). Runs as SECURITY DEFINER, so it
-- re-checks ownership itself rather than relying on RLS.
create or replace function public.accept_victor_record(p_record_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_list_id uuid;
  v_level_id uuid;
  v_submitted_by uuid;
  v_status text;
  v_owner uuid;
  v_is_editor boolean;
begin
  select list_id, level_id, submitted_by, status
    into v_list_id, v_level_id, v_submitted_by, v_status
  from records where id = p_record_id and type = 'victor';

  if v_list_id is null then
    raise exception 'record not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'record is not pending';
  end if;

  select owner_id into v_owner from lists where id = v_list_id;
  select exists(select 1 from list_editors where list_id = v_list_id and user_id = auth.uid())
    into v_is_editor;
  if auth.uid() is distinct from v_owner and not v_is_editor then
    raise exception 'not authorized';
  end if;

  insert into level_victors (level_id, user_id)
  values (v_level_id, v_submitted_by)
  on conflict do nothing;

  update records set status = 'accepted' where id = p_record_id;
end;
$$;

-- ============================================================
-- ADMIN SUPPORT (added for the admin console rebuild)
-- ============================================================

-- Testing-sandbox accounts get this flag; their lists are hidden from
-- everyone but themselves and admins (see the updated "lists are publicly
-- readable" policy below) — real isolation enforced in RLS, not just a
-- different UI path.
alter table profiles add column if not exists is_test boolean not null default false;

-- The existing "users manage their own profile" policy lets a user UPDATE
-- their own row with no column restriction — meaning, as originally
-- written, anyone could set their own is_admin to true from the browser.
-- This trigger closes that: is_admin/is_test can only change when the
-- request has no end-user JWT attached, i.e. a raw SQL Editor query or a
-- server action using the service_role key — never the normal logged-in
-- client. This is also how the very first admin account gets promoted:
-- manually, once, via the SQL Editor.
create or replace function public.protect_privilege_flags()
returns trigger
language plpgsql
as $$
begin
  if (new.is_admin is distinct from old.is_admin or new.is_test is distinct from old.is_test)
     and auth.uid() is not null then
    raise exception 'is_admin and is_test can only be changed outside the normal client (SQL editor or a service-role server action).';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privilege_flags on profiles;
create trigger profiles_protect_privilege_flags
  before update on profiles
  for each row execute function public.protect_privilege_flags();

-- Admins can rename any account (used for the Testing sandbox's "rename a
-- tester" feature); protect_privilege_flags above still blocks is_admin/
-- is_test changes even through this policy, so this can't be used to
-- self-promote.
create policy "admins manage any profile"
  on profiles for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Update handle_new_user so a tester account created with
-- options.data.is_test = true (set server-side, using the service role —
-- see is_test's protection above) gets is_test set at creation time. This
-- is an INSERT, not an UPDATE, so protect_privilege_flags doesn't apply to
-- it — the trigger only guards changes to an existing row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, is_test)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce((new.raw_user_meta_data->>'is_test')::boolean, false)
  );
  return new;
end;
$$;

-- Replaces the original "lists are publicly readable" policy: same public
-- readability, except a list owned by a testing-sandbox account is hidden
-- from everyone except that tester and admins — keeping sandbox data out
-- of real users' dashboards, search, and stats.
drop policy if exists "lists are publicly readable" on lists;
create policy "lists are publicly readable"
  on lists for select using (
    not exists (select 1 from profiles p where p.id = owner_id and p.is_test)
    or auth.uid() = owner_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Hiding a tester's own lists (above) isn't enough on its own — a tester
-- browsing a REAL list still passes every other check as an ordinary
-- non-owner user, so without this they could submit a real record onto
-- someone else's real list (or vice versa) just by using the app
-- normally, no dev tools required. This keeps records — and therefore
-- points and victor credit — from crossing the sandbox boundary either
-- direction: a submitter and the list they're submitting to must both be
-- test, or both be real.
create or replace function public.check_record_not_from_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
  v_submitter_is_test boolean;
  v_owner_is_test boolean;
begin
  select owner_id into v_owner from lists where id = new.list_id;
  if v_owner = new.submitted_by then
    raise exception 'The list owner cannot submit a record to their own list.';
  end if;

  select is_test into v_submitter_is_test from profiles where id = new.submitted_by;
  select is_test into v_owner_is_test from profiles where id = v_owner;
  if coalesce(v_submitter_is_test, false) is distinct from coalesce(v_owner_is_test, false) then
    raise exception 'Testing sandbox accounts can only submit records to testing sandbox lists.';
  end if;

  return new;
end;
$$;

-- ============================================================
-- FIX: RLS RECURSION BETWEEN lists AND list_editors
-- "owners and editors update lists" (on lists) checks list_editors; "list
-- owners manage editors" (on list_editors, added for the Settings
-- editor-invite feature) checks lists right back. That's a genuine cycle
-- — Postgres refuses to evaluate a policy that requires re-evaluating
-- itself before finishing, and errors with "infinite recursion detected
-- in policy for relation lists" the moment anything hits an UPDATE on
-- lists (Points Config's and Settings' Save buttons both do).
--
-- Fix: do the ownership/editor check in a SECURITY DEFINER function
-- instead of inline in each policy. Its internal queries run as the
-- function's owner (which owns these tables), so they bypass RLS instead
-- of re-triggering the very policies calling it — breaking the cycle.
-- ============================================================
create or replace function public.is_list_owner_or_editor(p_list_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from lists l where l.id = p_list_id and l.owner_id = p_user_id)
      or exists (select 1 from list_editors e where e.list_id = p_list_id and e.user_id = p_user_id);
$$;

drop policy if exists "owners and editors update lists" on lists;
create policy "owners and editors update lists"
  on lists for update using (public.is_list_owner_or_editor(id, auth.uid()));

drop policy if exists "owners and editors manage levels" on levels;
create policy "owners and editors manage levels"
  on levels for all using (public.is_list_owner_or_editor(list_id, auth.uid()));

drop policy if exists "owners and editors see all records for their list" on records;
create policy "owners and editors see all records for their list"
  on records for select using (public.is_list_owner_or_editor(list_id, auth.uid()));

drop policy if exists "owners and editors update record status" on records;
create policy "owners and editors update record status"
  on records for update using (public.is_list_owner_or_editor(list_id, auth.uid()));
