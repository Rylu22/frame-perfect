import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tierByKey } from "@/lib/tiers";

export default async function LegacyListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: list } = await supabase.from("lists").select("id, name").eq("id", id).single();
  if (!list) notFound();

  const { data: legacyLevels } = await supabase
    .from("legacy_levels")
    .select("id, name, difficulty, best_rank, pushed_off_by")
    .eq("list_id", id)
    .order("best_rank", { ascending: true });

  const rows = legacyLevels ?? [];

  return (
    <div className="page">
      <div className="wrap">
        <Link className="back-link" href={`/lists/${id}`}>
          &larr; back to list
        </Link>
        <h2 style={{ margin: "14px 0 18px" }}>Legacy List — {list.name}</h2>

        {rows.length === 0 ? (
          <div className="empty-note">No levels have fallen off this list yet.</div>
        ) : (
          <div className="legacy-list">
            {rows.map((lv, i) => {
              const tier = tierByKey(lv.difficulty);
              return (
                <div className="legacy-row" key={lv.id}>
                  <div className="lg-left">
                    <span className="lg-name">{lv.name}</span>
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
