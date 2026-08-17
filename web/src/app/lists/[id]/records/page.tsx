import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditList } from "@/lib/list-access";
import RecordFeed, { type FeedRecord } from "./record-feed";

type RecordQueryRow = {
  id: string;
  submitted_by: string;
  type: "victor" | "verifier";
  level_id: string | null;
  level_name: string | null;
  difficulty: string | null;
  video_url: string | null;
  status: "pending" | "accepted" | "declined";
  decline_reason: string | null;
  created_at: string;
  profiles: { username: string } | { username: string }[] | null;
  levels: { name: string } | { name: string }[] | null;
};

export default async function RecordFeedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, owner_id, points_mode, profiles!owner_id(username)")
    .eq("id", id)
    .single();

  if (!list) notFound();
  if (!(await canEditList(supabase, id, user?.id))) redirect(`/lists/${id}`);

  const ownerProfile = Array.isArray(list.profiles) ? list.profiles[0] : list.profiles;

  const { count: levelCount } = await supabase
    .from("levels")
    .select("id", { count: "exact", head: true })
    .eq("list_id", id);

  const { data: recordRows } = await supabase
    .from("records")
    .select(
      "id, submitted_by, type, level_id, level_name, difficulty, video_url, status, decline_reason, created_at, profiles!submitted_by(username), levels!level_id(name)",
    )
    .eq("list_id", id)
    .order("created_at", { ascending: false })
    .returns<RecordQueryRow[]>();

  const records: FeedRecord[] = (recordRows ?? []).map((r) => {
    const submitter = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const level = Array.isArray(r.levels) ? r.levels[0] : r.levels;
    return {
      id: r.id,
      submitted_by: r.submitted_by,
      submitter_username: submitter?.username ?? "unknown",
      type: r.type,
      level_id: r.level_id,
      level_name: r.level_name ?? level?.name ?? null,
      difficulty: r.difficulty,
      video_url: r.video_url,
      status: r.status,
      decline_reason: r.decline_reason,
    };
  });

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={`/lists/${id}`}>
          &larr; back to list
        </Link>
        <RecordFeed
          listId={id}
          listName={list.name}
          ownerUsername={ownerProfile?.username ?? "unknown"}
          pointsMode={list.points_mode === "rank" ? "rank" : "level"}
          levelCount={levelCount ?? 0}
          records={records}
        />
      </div>
    </div>
  );
}
