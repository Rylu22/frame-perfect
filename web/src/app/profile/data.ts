import type { SupabaseClient } from "@supabase/supabase-js";
import { loadListPointsData } from "@/app/lists/[id]/stats/data";

// Every list id where this user has a victory or verification credit —
// gathered from all four sources (active/legacy levels x victor/verifier)
// since "participated in" isn't tracked as its own column anywhere.
async function getParticipatedListIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const [victorRows, legacyVictorRows, verifierRows, legacyVerifierRows] = await Promise.all([
    supabase.from("level_victors").select("levels!level_id(list_id)").eq("user_id", userId),
    supabase.from("legacy_victors").select("legacy_levels!legacy_level_id(list_id)").eq("user_id", userId),
    supabase.from("levels").select("list_id").eq("verifier_id", userId),
    supabase.from("legacy_levels").select("list_id").eq("verifier_id", userId),
  ]);

  const listIds = new Set<string>();

  type LevelsEmbed = { list_id: string } | { list_id: string }[] | null;
  for (const row of (victorRows.data ?? []) as { levels: LevelsEmbed }[]) {
    const l = Array.isArray(row.levels) ? row.levels[0] : row.levels;
    if (l?.list_id) listIds.add(l.list_id);
  }
  for (const row of (legacyVictorRows.data ?? []) as { legacy_levels: LevelsEmbed }[]) {
    const l = Array.isArray(row.legacy_levels) ? row.legacy_levels[0] : row.legacy_levels;
    if (l?.list_id) listIds.add(l.list_id);
  }
  for (const row of (verifierRows.data ?? []) as { list_id: string }[]) {
    listIds.add(row.list_id);
  }
  for (const row of (legacyVerifierRows.data ?? []) as { list_id: string }[]) {
    listIds.add(row.list_id);
  }

  return [...listIds];
}

export type ProfileListRow = {
  listId: string;
  listName: string;
  rank: number;
  points: number;
};

export async function getProfileListRows(supabase: SupabaseClient, userId: string): Promise<ProfileListRow[]> {
  const listIds = await getParticipatedListIds(supabase, userId);
  if (listIds.length === 0) return [];

  const { data: lists } = await supabase.from("lists").select("id, name").in("id", listIds);
  const nameById = new Map((lists ?? []).map((l) => [l.id, l.name]));

  const rows: ProfileListRow[] = [];
  for (const listId of listIds) {
    const data = await loadListPointsData(listId);
    if (!data) continue;
    const idx = data.standings.findIndex((s) => s.userId === userId);
    if (idx === -1) continue;
    rows.push({
      listId,
      listName: nameById.get(listId) ?? "Unknown list",
      rank: idx + 1,
      points: data.standings[idx].points,
    });
  }

  return rows.sort((a, b) => a.listName.localeCompare(b.listName));
}
