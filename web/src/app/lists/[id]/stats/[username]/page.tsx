import Link from "next/link";
import { notFound } from "next/navigation";
import { tierByKey } from "@/lib/tiers";
import { getLevelPoints } from "@/lib/points";
import { loadListPointsData } from "../data";

export default async function PlayerStatsPage({
  params,
}: {
  params: Promise<{ id: string; username: string }>;
}) {
  const { id, username } = await params;
  const data = await loadListPointsData(id);
  if (!data) notFound();

  const entry = data.standings.find((s) => s.username.toLowerCase() === username.toLowerCase());
  if (!entry) notFound();

  const pointsMode = data.list.points_mode === "rank" ? "rank" : "level";
  const rankPoints = (data.list.rank_points as Record<string, number>) ?? {};

  const activeVictories = data.levels
    .filter((lv) => (data.victorsByLevel.get(lv.id) ?? []).includes(entry.userId))
    .map((lv) => ({ ...lv, pts: getLevelPoints(lv, pointsMode, rankPoints) }));
  const activeVerifications = data.levels
    .filter((lv) => lv.verifier_id === entry.userId)
    .map((lv) => ({ ...lv, pts: getLevelPoints(lv, pointsMode, rankPoints) }));

  const legacyVictories = data.legacyLevels
    .filter((lv) => (data.legacyVictorsByLevel.get(lv.id) ?? []).includes(entry.userId))
    .map((lv) => ({ ...lv, position: null as number | null, pts: lv.points }));
  const legacyVerifications = data.legacyLevels
    .filter((lv) => lv.verifier_id === entry.userId)
    .map((lv) => ({ ...lv, position: null as number | null, pts: lv.points }));

  const victories = [...activeVictories, ...legacyVictories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const verifications = [...activeVerifications, ...legacyVerifications].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={`/lists/${id}/stats`}>
          &larr; back to stats
        </Link>
        <h2 style={{ margin: "14px 0 4px" }}>{entry.username}</h2>
        <div className="msg ok" style={{ marginTop: 0, marginBottom: "20px" }}>
          {entry.points.toFixed(2)} pts on this list
        </div>

        <div className="section-title" style={{ marginTop: 0 }}>
          Victories
        </div>
        <RecordGroup levels={victories} />

        <div className="section-title">Verifications</div>
        <RecordGroup levels={verifications} />
      </div>
    </div>
  );
}

function RecordGroup({
  levels,
}: {
  levels: { id: string; name: string; difficulty: string; position: number | null; pts: number }[];
}) {
  if (levels.length === 0) return <div className="empty-note">None yet.</div>;
  return (
    <>
      {levels.map((lv) => {
        const tier = tierByKey(lv.difficulty);
        return (
          <div className="record-card" key={lv.id}>
            <div className="record-top">
              <span className="who">
                {lv.position ? `#${lv.position} ` : ""}
                {lv.name}
              </span>
              {tier && (
                <span className="tier-tag" style={{ "--tier": tier.color } as React.CSSProperties}>
                  {tier.label}
                </span>
              )}
            </div>
            <div className="record-meta">{lv.pts.toFixed(2)} pts</div>
          </div>
        );
      })}
    </>
  );
}
