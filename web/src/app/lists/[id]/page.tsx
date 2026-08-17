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
  profiles: { username: string } | { username: string }[] | null;
  level_victors: { count: number }[] | null;
};

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  const canEdit = !viewAsUserId && (await canEditList(supabase, id, user?.id));

  const { data: levelRows } = await supabase
    .from("levels")
    .select(
      "id, name, difficulty, verifier_id, publisher, points, position, image_url, profiles!verifier_id(username), level_victors(count)",
    )
    .eq("list_id", id)
    .order("position")
    .returns<LevelQueryRow[]>();

  const levels: BuilderLevel[] = (levelRows ?? []).map((row) => {
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
      victor_count: row.level_victors?.[0]?.count ?? 0,
    };
  });

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

        {canEdit ? (
          <Builder
            listId={list.id}
            listName={list.name}
            targetSize={list.target_size}
            pointsMode={pointsMode}
            ownerUsername={ownerUsername}
            levels={levels}
          />
        ) : (
          <ViewerSection
            listId={list.id}
            listName={list.name}
            ownerUsername={ownerUsername}
            targetSize={list.target_size}
            levels={levels}
            userId={effectiveUserId}
            canSubmit={user !== null && !viewAsUserId}
          />
        )}
      </div>
    </div>
  );
}

async function ViewerSection({
  listId,
  listName,
  ownerUsername,
  targetSize,
  levels,
  userId,
  canSubmit,
}: {
  listId: string;
  listName: string;
  ownerUsername: string;
  targetSize: number;
  levels: BuilderLevel[];
  userId: string | null;
  canSubmit: boolean;
}) {
  let myPoints: number | null = null;
  let myCompleted: number | null = null;

  if (userId) {
    const data = await loadListPointsData(listId);
    if (data) {
      myPoints = data.standings.find((s) => s.userId === userId)?.points ?? 0;
      myCompleted = data.levels.filter((lv) => (data.victorsByLevel.get(lv.id) ?? []).includes(userId)).length;
    }
  }

  return (
    <Viewer
      listId={listId}
      listName={listName}
      ownerUsername={ownerUsername}
      targetSize={targetSize}
      levels={levels}
      isLoggedIn={userId !== null}
      canSubmit={canSubmit}
      myPoints={myPoints}
      myCompleted={myCompleted}
    />
  );
}
