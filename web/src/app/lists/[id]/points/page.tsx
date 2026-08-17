import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditList } from "@/lib/list-access";
import PointsConfigForm from "./points-config-form";

export default async function PointsConfigPage({
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
    .select("id, name, target_size, owner_id, points_mode, rank_points")
    .eq("id", id)
    .single();

  if (!list) notFound();
  if (!(await canEditList(supabase, id, user?.id))) redirect(`/lists/${id}`);

  const { data: edgeLevels } = await supabase
    .from("levels")
    .select("name, position")
    .eq("list_id", id)
    .in("position", [1, list.target_size]);

  const topLevelName = edgeLevels?.find((l) => l.position === 1)?.name ?? null;
  const bottomLevelName = edgeLevels?.find((l) => l.position === list.target_size)?.name ?? null;

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={`/lists/${id}`}>
          &larr; back to list
        </Link>
        <h2 style={{ margin: "14px 0 18px" }}>Points Config — {list.name}</h2>
        <PointsConfigForm
          listId={id}
          targetSize={list.target_size}
          pointsMode={list.points_mode === "rank" ? "rank" : "level"}
          rankPoints={(list.rank_points as Record<string, number>) ?? {}}
          topLevelName={topLevelName}
          bottomLevelName={bottomLevelName}
        />
      </div>
    </div>
  );
}
