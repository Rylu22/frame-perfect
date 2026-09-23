import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewAsContext } from "@/lib/view-as";
import { canEditList } from "@/lib/list-access";
import ProgressBoard, { type ProgressBlock } from "./progress-board";

type ProgressQueryRow = {
  id: string;
  user_id: string;
  mode: "beating" | "verifying";
  level_id: string | null;
  level_name: string | null;
  estimated_rank: number | null;
  publisher: string;
  thumbnail_url: string | null;
  runs: { start: number; end: number }[];
  position: number;
  profiles: { username: string } | { username: string }[] | null;
  levels:
    | { name: string; position: number; image_url: string | null }
    | { name: string; position: number; image_url: string | null }[]
    | null;
};

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, viewAsUserId } = await getViewAsContext();

  const { data: list } = await supabase.from("lists").select("id, name").eq("id", id).single();
  if (!list) notFound();

  // Same rule as the main Builder/Viewer split: while viewing-as, never
  // show reorder controls even for an account that owns/edits this list.
  const canReorder = !viewAsUserId && (await canEditList(supabase, id, user?.id));

  const { data: levelRows } = await supabase
    .from("levels")
    .select("id, name, position")
    .eq("list_id", id)
    .order("position");

  const { data: progressRows } = await supabase
    .from("level_progress")
    .select(
      "id, user_id, mode, level_id, level_name, estimated_rank, publisher, thumbnail_url, runs, position, profiles!user_id(username), levels(name, position, image_url)",
    )
    .eq("list_id", id)
    .order("position")
    .returns<ProgressQueryRow[]>();

  const blocks: ProgressBlock[] = (progressRows ?? []).map((row) => {
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const level = Array.isArray(row.levels) ? row.levels[0] : row.levels;
    return {
      id: row.id,
      userId: row.user_id,
      username: author?.username ?? "unknown",
      mode: row.mode,
      levelId: row.level_id,
      levelName: level?.name ?? row.level_name ?? "",
      rank: row.mode === "beating" ? (level?.position ?? null) : row.estimated_rank,
      publisher: row.publisher,
      thumbnailUrl: row.mode === "beating" ? (level?.image_url ?? null) : row.thumbnail_url,
      runs: row.runs ?? [],
      position: row.position,
    };
  });

  return (
    <div className="page">
      <div className="wrap">
        <Link className="back-link" href={`/lists/${id}`}>
          &larr; back to list
        </Link>
        <h2 style={{ margin: "14px 0 18px" }}>Progress — {list.name}</h2>

        <ProgressBoard
          listId={id}
          levels={levelRows ?? []}
          blocks={blocks}
          currentUserId={user?.id ?? null}
          readOnly={!!viewAsUserId}
          canReorder={canReorder}
        />
      </div>
    </div>
  );
}
