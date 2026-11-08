import { createClient } from "@/lib/supabase/server";
import { computeStandings, type ActiveLevelForPoints, type LegacyLevelForPoints } from "@/lib/points";
import { loadListStateAt, type ListAtTime } from "@/lib/time-machine";

export type StatsLevel = {
  id: string;
  name: string;
  difficulty: string;
  position: number;
  points: number;
  verifier_id: string | null;
};

export type StatsLegacyLevel = {
  id: string;
  name: string;
  difficulty: string;
  points: number;
  verifier_id: string | null;
};

type RawData = {
  pointsMode: "level" | "rank";
  rankPoints: Record<string, number>;
  levels: StatsLevel[];
  legacyLevels: StatsLegacyLevel[];
  victorsByLevel: Map<string, string[]>;
  legacyVictorsByLevel: Map<string, string[]>;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadCurrent(
  supabase: Supabase,
  listId: string,
  list: { points_mode: string; rank_points: unknown },
): Promise<RawData> {
  const [{ data: levels }, { data: legacyLevels }] = await Promise.all([
    supabase
      .from("levels")
      .select("id, name, difficulty, position, points, verifier_id")
      .eq("list_id", listId)
      .returns<StatsLevel[]>(),
    supabase
      .from("legacy_levels")
      .select("id, name, difficulty, points, verifier_id")
      .eq("list_id", listId)
      .returns<StatsLegacyLevel[]>(),
  ]);

  const levelIds = (levels ?? []).map((l) => l.id);
  const legacyIds = (legacyLevels ?? []).map((l) => l.id);

  const [{ data: victors }, { data: legacyVictors }] = await Promise.all([
    levelIds.length
      ? supabase.from("level_victors").select("level_id, user_id").in("level_id", levelIds)
      : Promise.resolve({ data: [] as { level_id: string; user_id: string }[] }),
    legacyIds.length
      ? supabase.from("legacy_victors").select("legacy_level_id, user_id").in("legacy_level_id", legacyIds)
      : Promise.resolve({ data: [] as { legacy_level_id: string; user_id: string }[] }),
  ]);

  const victorsByLevel = new Map<string, string[]>();
  for (const v of victors ?? []) {
    victorsByLevel.set(v.level_id, [...(victorsByLevel.get(v.level_id) ?? []), v.user_id]);
  }
  const legacyVictorsByLevel = new Map<string, string[]>();
  for (const v of legacyVictors ?? []) {
    legacyVictorsByLevel.set(v.legacy_level_id, [
      ...(legacyVictorsByLevel.get(v.legacy_level_id) ?? []),
      v.user_id,
    ]);
  }

  return {
    pointsMode: list.points_mode === "rank" ? "rank" : "level",
    rankPoints: (list.rank_points as Record<string, number>) ?? {},
    levels: (levels ?? []).map((l) => ({ ...l, points: Number(l.points) })),
    legacyLevels: (legacyLevels ?? []).map((l) => ({ ...l, points: Number(l.points) })),
    victorsByLevel,
    legacyVictorsByLevel,
  };
}

function fromSnapshot(tm: ListAtTime): RawData {
  const state = tm.state;
  return {
    pointsMode: state?.points_mode ?? "level",
    rankPoints: state?.rank_points ?? {},
    levels: (state?.levels ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      difficulty: l.difficulty,
      position: l.position,
      points: l.points,
      verifier_id: l.verifier_id,
    })),
    legacyLevels: (state?.legacy ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      difficulty: l.difficulty,
      points: l.points,
      verifier_id: l.verifier_id,
    })),
    victorsByLevel: new Map((state?.levels ?? []).map((l) => [l.id, l.victors])),
    legacyVictorsByLevel: new Map((state?.legacy ?? []).map((l) => [l.id, l.victors])),
  };
}

// `at` (an ISO timestamp, from the time machine) loads the list as it was
// at that moment from its snapshot history instead of its live tables.
export async function loadListPointsData(listId: string, at?: string | null) {
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, points_mode, rank_points")
    .eq("id", listId)
    .single();

  if (!list) return null;

  const timeMachine = at ? await loadListStateAt(supabase, listId, at) : null;
  const raw = timeMachine ? fromSnapshot(timeMachine) : await loadCurrent(supabase, listId, list);

  const activeForPoints: ActiveLevelForPoints[] = raw.levels.map((l) => ({
    id: l.id,
    position: l.position,
    points: l.points,
    verifier_id: l.verifier_id,
  }));
  const legacyForPoints: LegacyLevelForPoints[] = raw.legacyLevels.map((l) => ({
    id: l.id,
    points: l.points,
    verifier_id: l.verifier_id,
  }));

  const standingsMap = computeStandings(
    activeForPoints,
    legacyForPoints,
    raw.victorsByLevel,
    raw.legacyVictorsByLevel,
    raw.pointsMode,
    raw.rankPoints,
  );

  const userIds = [...standingsMap.keys()];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, username").in("id", userIds)
    : { data: [] as { id: string; username: string }[] };
  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const standings = [...standingsMap.entries()]
    .map(([userId, points]) => ({ userId, username: usernameById.get(userId) ?? "unknown", points }))
    .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));

  return {
    list,
    pointsMode: raw.pointsMode,
    rankPoints: raw.rankPoints,
    levels: raw.levels,
    legacyLevels: raw.legacyLevels,
    victorsByLevel: raw.victorsByLevel,
    legacyVictorsByLevel: raw.legacyVictorsByLevel,
    standings,
    timeMachine,
  };
}

