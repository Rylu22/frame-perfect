import type { SupabaseClient } from "@supabase/supabase-js";

// Shape of list_snapshots.state (see build_list_state in supabase-schema.sql).
export type SnapshotLevel = {
  id: string;
  name: string;
  difficulty: string;
  position: number;
  points: number;
  verifier_id: string | null;
  publisher: string | null;
  victors: string[];
};

export type SnapshotLegacyLevel = {
  id: string;
  name: string;
  difficulty: string;
  points: number;
  best_rank: number;
  pushed_off_by: string | null;
  verifier_id: string | null;
  victors: string[];
};

export type ListState = {
  points_mode: "level" | "rank";
  rank_points: Record<string, number>;
  target_size: number;
  levels: SnapshotLevel[];
  legacy: SnapshotLegacyLevel[];
};

export type ListAtTime = {
  // null when the requested moment predates history tracking for this list.
  state: ListState | null;
  trackingStart: string | null;
};

// Reads the ?at= search param. Returns null (meaning "the present") for a
// missing/invalid value or one that isn't in the past.
export function parseAt(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getTime() >= Date.now()) return null;
  return d.toISOString();
}

// Appends ?at= to an in-app link while the time machine is active.
export function withAt(href: string, at: string | null | undefined): string {
  if (!at) return href;
  return `${href}${href.includes("?") ? "&" : "?"}at=${encodeURIComponent(at)}`;
}

function normalizeState(raw: unknown): ListState {
  const s = (raw ?? {}) as Partial<ListState>;
  return {
    points_mode: s.points_mode === "rank" ? "rank" : "level",
    rank_points: s.rank_points ?? {},
    target_size: Number(s.target_size ?? 0),
    levels: (s.levels ?? [])
      .map((l) => ({ ...l, position: Number(l.position), points: Number(l.points), victors: l.victors ?? [] }))
      .sort((a, b) => a.position - b.position),
    legacy: (s.legacy ?? [])
      .map((l) => ({ ...l, points: Number(l.points), best_rank: Number(l.best_rank), victors: l.victors ?? [] }))
      .sort((a, b) => a.best_rank - b.best_rank),
  };
}

export async function loadListStateAt(supabase: SupabaseClient, listId: string, at: string): Promise<ListAtTime> {
  const [{ data: snap }, { data: first }] = await Promise.all([
    supabase
      .from("list_snapshots")
      .select("state")
      .eq("list_id", listId)
      .lte("created_at", at)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("list_snapshots")
      .select("created_at, cause")
      .eq("list_id", listId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const trackingStart = (first?.created_at as string | undefined) ?? null;
  if (snap) return { state: normalizeState(snap.state), trackingStart };

  // Nothing recorded at or before `at`. If the list's first snapshot is a
  // creation, the list simply didn't exist yet — show it empty. If it's the
  // baseline taken when tracking was switched on, the list did exist but
  // we don't know what it looked like.
  const firstCause = (first?.cause as { type?: string } | undefined)?.type;
  if (first && firstCause !== "baseline") {
    return {
      state: { points_mode: "level", rank_points: {}, target_size: 0, levels: [], legacy: [] },
      trackingStart,
    };
  }
  return { state: null, trackingStart };
}
