import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewAsContext } from "@/lib/view-as";
import { stopViewAs } from "@/app/admin/actions";
import { getLevelPoints } from "@/lib/points";
import { canEditList } from "@/lib/list-access";
import Builder, { type BuilderLevel } from "./builder";
import Viewer from "./viewer";
import { loadListPointsData } from "./stats/data";
import TimeMachine from "@/components/time-machine";
import { loadListStateAt, parseAt, type ListAtTime } from "@/lib/time-machine";

type ListQueryRow = {
  id: string;
  name: string;
  target_size: number;
  owner_id: string;
  points_mode: string;
  rank_points: Record<string, number> | null;
  profiles: { username: string } | { username: string }[] | null;
};

type LevelQueryRow = {
  id: string;
  name: string;
  difficulty: string;
  verifier_id: string | null;
  publisher: string | null;
  points: number;
  position: number;
  image_url: string | null;
  description: string | null;
  profiles: { username: string } | { username: string }[] | null;
  level_victors: { count: number }[] | null;
};

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const at = parseAt((await searchParams).at);
  const supabase = await createClient();
  const { user, viewAsUserId, viewAsUsername, effectiveUserId } = await getViewAsContext();

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, target_size, owner_id, points_mode, rank_points, profiles!owner_id(username)")
    .eq("id", id)
    .single<ListQueryRow>();

  if (!list) {
    notFound();
  }

  const ownerProfile = Array.isArray(list.profiles) ? list.profiles[0] : list.profiles;
  const ownerUsername = ownerProfile?.username ?? "unknown";
  const pointsMode = list.points_mode === "rank" ? "rank" : "level";
  const rankPoints = list.rank_points ?? {};
  // While viewing-as, always show the read-only Viewer — even if the
  // account being viewed owns (or edits) this list — since writes should
  // never be possible in this mode.
  // The time machine is read-only too.
  const canEdit = !viewAsUserId && !at && (await canEditList(supabase, id, user?.id));

  let timeMachine: ListAtTime | null = null;
  let levels: BuilderLevel[];
  if (at) {
    timeMachine = await loadListStateAt(supabase, id, at);
    levels = await levelsFromSnapshot(supabase, timeMachine);
  } else {
    levels = await currentLevels(supabase, id, pointsMode, rankPoints);
  }
  const targetSize = timeMachine?.state?.target_size || list.target_size;

  return (
    <div className="page">
      <div className="wrap">
        <Link className="back-link" href="/dashboard">
          &larr; back to dashboard
        </Link>

        {viewAsUserId && (
          <div className="mode-banner viewonly" style={{ marginTop: "14px" }}>
            <span>
              &#128065; Viewing as <b>{viewAsUsername ?? "unknown"}</b> — read only
            </span>
            <form action={stopViewAs}>
              <button className="mb-exit" type="submit">
                Exit
              </button>
            </form>
          </div>
        )}

        <TimeMachine
          at={at}
          trackingStart={timeMachine?.trackingStart ?? null}
          beforeTracking={timeMachine !== null && timeMachine.state === null}
        />

        {canEdit ? (
          <Builder
            listId={list.id}
            listName={list.name}
            targetSize={list.target_size}
            pointsMode={pointsMode}
            levels={levels}
          />
        ) : (
          <ViewerSection
            listId={list.id}
            listName={list.name}
            ownerUsername={ownerUsername}
            targetSize={targetSize}
            levels={levels}
            userId={effectiveUserId}
            canSubmit={user !== null && !viewAsUserId}
            at={at}
          />
        )}
      </div>
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function currentLevels(
  supabase: Supabase,
  id: string,
  pointsMode: "level" | "rank",
  rankPoints: Record<string, number>,
): Promise<BuilderLevel[]> {
  const { data: levelRows } = await supabase
    .from("levels")
    .select(
      "id, name, difficulty, verifier_id, publisher, points, position, image_url, description, profiles!verifier_id(username), level_victors(count)",
    )
    .eq("list_id", id)
    .order("position")
    .returns<LevelQueryRow[]>();

  return (levelRows ?? []).map((row) => {
    const verifierProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    // The level card always shows the points a victory is currently worth
    // — in rank-locked mode that's rank_points[position], not the raw
    // (unused) levels.points column, so it stays live if either changes.
    const displayPoints = getLevelPoints(
      { points: Number(row.points), position: row.position },
      pointsMode,
      rankPoints,
    );
    return {
      id: row.id,
      name: row.name,
      difficulty: row.difficulty,
      verifier_id: row.verifier_id,
      verifier_username: verifierProfile?.username ?? null,
      publisher: row.publisher,
      points: displayPoints,
      raw_points: Number(row.points),
      position: row.position,
      image_url: row.image_url,
      description: row.description ?? "",
      victor_count: row.level_victors?.[0]?.count ?? 0,
    };
  });
}

// The list as it was at the time machine moment. Images and descriptions
// aren't part of snapshots, so levels still around today show their
// current ones.
async function levelsFromSnapshot(supabase: Supabase, tm: ListAtTime): Promise<BuilderLevel[]> {
  const state = tm.state;
  if (!state) return [];
  const ids = state.levels.map((l) => l.id);
  const verifierIds = [...new Set(state.levels.map((l) => l.verifier_id).filter((v): v is string => !!v))];
  const [{ data: current }, { data: profiles }] = await Promise.all([
    ids.length
      ? supabase.from("levels").select("id, image_url, description").in("id", ids)
      : Promise.resolve({ data: [] as { id: string; image_url: string | null; description: string | null }[] }),
    verifierIds.length
      ? supabase.from("profiles").select("id, username").in("id", verifierIds)
      : Promise.resolve({ data: [] as { id: string; username: string }[] }),
  ]);
  const currentById = new Map((current ?? []).map((c) => [c.id, c]));
  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  return state.levels.map((l) => ({
    id: l.id,
    name: l.name,
    difficulty: l.difficulty,
    verifier_id: l.verifier_id,
    verifier_username: l.verifier_id ? (usernameById.get(l.verifier_id) ?? null) : null,
    publisher: l.publisher,
    points: getLevelPoints(l, state.points_mode, state.rank_points),
    raw_points: l.points,
    position: l.position,
    image_url: currentById.get(l.id)?.image_url ?? null,
    description: currentById.get(l.id)?.description ?? "",
    victor_count: l.victors.length,
  }));
}

async function ViewerSection({
  listId,
  listName,
  ownerUsername,
  targetSize,
  levels,
  userId,
  canSubmit,
  at,
}: {
  listId: string;
  listName: string;
  ownerUsername: string;
  targetSize: number;
  levels: BuilderLevel[];
  userId: string | null;
  canSubmit: boolean;
  at: string | null;
}) {
  let myPoints: number | null = null;
  let myCompleted: number | null = null;
  const completedLevelIds = new Set<string>();

  if (userId) {
    const data = await loadListPointsData(listId, at);
    if (data) {
      myPoints = data.standings.find((s) => s.userId === userId)?.points ?? 0;
      // Verifying a level counts as completing it too, same as beating it.
      for (const lv of data.levels) {
        if ((data.victorsByLevel.get(lv.id) ?? []).includes(userId)) completedLevelIds.add(lv.id);
        if (lv.verifier_id === userId) completedLevelIds.add(lv.id);
      }
      myCompleted = completedLevelIds.size;
    }
  }

  return (
    <Viewer
      listId={listId}
      listName={listName}
      ownerUsername={ownerUsername}
      targetSize={targetSize}
      levels={levels}
      completedLevelIds={completedLevelIds}
      isLoggedIn={userId !== null}
      canSubmit={canSubmit}
      myPoints={myPoints}
      myCompleted={myCompleted}
      at={at}
    />
  );
}
