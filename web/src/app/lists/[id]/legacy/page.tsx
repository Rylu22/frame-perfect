import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tierByKey } from "@/lib/tiers";
import TimeMachine from "@/components/time-machine";
import { loadListStateAt, parseAt, withAt, type ListAtTime } from "@/lib/time-machine";
import HistoryButton from "../level-history";

type LegacyRow = { id: string; name: string; difficulty: string | null; best_rank: number; pushed_off_by: string | null };

export default async function LegacyListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const at = parseAt((await searchParams).at);
  const supabase = await createClient();

  const { data: list } = await supabase.from("lists").select("id, name").eq("id", id).single();
  if (!list) notFound();

  let rows: LegacyRow[];
  let timeMachine: ListAtTime | null = null;
  if (at) {
    timeMachine = await loadListStateAt(supabase, id, at);
    rows = timeMachine.state?.legacy ?? [];
  } else {
    const { data: legacyLevels } = await supabase
      .from("legacy_levels")
      .select("id, name, difficulty, best_rank, pushed_off_by")
      .eq("list_id", id)
      .order("best_rank", { ascending: true });
    rows = legacyLevels ?? [];
  }

  return (
    <div className="page">
      <div className="wrap">
        <Link className="back-link" href={withAt(`/lists/${id}`, at)}>
          &larr; back to list
        </Link>
        <TimeMachine
          at={at}
          trackingStart={timeMachine?.trackingStart ?? null}
          beforeTracking={timeMachine !== null && timeMachine.state === null}
        />
        <h2 style={{ margin: "14px 0 18px" }}>Legacy List — {list.name}</h2>

        {rows.length === 0 ? (
          <div className="empty-note">No levels had fallen off this list{at ? " by then" : " yet"}.</div>
        ) : (
          <div className="legacy-list">
            {rows.map((lv, i) => {
              const tier = lv.difficulty ? tierByKey(lv.difficulty) : null;
              return (
                <div className="legacy-row" key={lv.id}>
                  <div className="lg-left">
                    <span className="lg-name" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {lv.name}
                      <HistoryButton listId={id} levelId={lv.id} levelName={lv.name} />
                    </span>
                    <span className="lg-sub">
                      Highest rank reached: #{lv.best_rank} {tier ? `· ${tier.label}` : ""} &middot; Pushed
                      off by: {lv.pushed_off_by || "—"}
                    </span>
                  </div>
                  <span className="lg-rank">#{i + 1}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
