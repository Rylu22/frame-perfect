import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewAsContext } from "@/lib/view-as";
import ProgressBoard, { type ProgressBlock } from "./progress-board";

type ProgressQueryRow = {
  id: string;
  user_id: string;
  mode: "beating" | "verifying";
  level_id: string | null;
  level_name: string | null;
  estimated_rank: number | null;
  permission_from: string;
  publisher: string;
  thumbnail_url: string | null;
  note1: string;
  note2: string;
  note3: string;
  profiles: { username: string } | { username: string }[] | null;
  levels: { name: string; position: number } | { name: string; position: number }[] | null;
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

  const { data: levelRows } = await supabase
    .from("levels")
    .select("id, name, position")
    .eq("list_id", id)
    .order("position");

  const { data: progressRows } = await supabase
    .from("level_progress")
    .select(
      "id, user_id, mode, level_id, level_name, estimated_rank, permission_from, publisher, thumbnail_url, note1, note2, note3, profiles!user_id(username), levels(name, position)",
    )
    .eq("list_id", id)
    .order("updated_at", { ascending: false })
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
      permissionFrom: row.permission_from,
      publisher: row.publisher,
      thumbnailUrl: row.thumbnail_url,
      note1: row.note1,
      note2: row.note2,
      note3: row.note3,
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
        />
      </div>
    </div>
  );
}
