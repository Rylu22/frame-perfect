import Link from "next/link";
import { notFound } from "next/navigation";
import { tierByKey } from "@/lib/tiers";
import { getLevelPoints } from "@/lib/points";
import TimeMachine from "@/components/time-machine";
import { parseAt, withAt } from "@/lib/time-machine";
import { createClient } from "@/lib/supabase/server";
import { loadListPointsData } from "../data";

export default async function PlayerStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; username: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, username } = await params;
  const at = parseAt((await searchParams).at);
  const data = await loadListPointsData(id, at);
  if (!data) notFound();

  let entry = data.standings.find((s) => s.username.toLowerCase() === username.toLowerCase());
  if (!entry && at) {
    // In the time machine, a player with points today may have had none
    // yet on the chosen date: show them at zero rather than a 404.
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", username)
      .maybeSingle();
    if (profile) entry = { userId: profile.id, username: profile.username, points: 0 };
  }
  if (!entry) notFound();
  const player = entry;

  const { pointsMode, rankPoints } = data;

  const activeVictories = data.levels
    .filter((lv) => (data.victorsByLevel.get(lv.id) ?? []).includes(player.userId))
    .map((lv) => ({ ...lv, pts: getLevelPoints(lv, pointsMode, rankPoints) }));
  const activeVerifications = data.levels
    .filter((lv) => lv.verifier_id === player.userId)
    .map((lv) => ({ ...lv, pts: getLevelPoints(lv, pointsMode, rankPoints) }));

  const legacyVictories = data.legacyLevels
    .filter((lv) => (data.legacyVictorsByLevel.get(lv.id) ?? []).includes(player.userId))
    .map((lv) => ({ ...lv, position: null as number | null, pts: lv.points }));
  const legacyVerifications = data.legacyLevels
    .filter((lv) => lv.verifier_id === player.userId)
    .map((lv) => ({ ...lv, position: null as number | null, pts: lv.points }));

  const victories = [...activeVictories, ...legacyVictories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const verifications = [...activeVerifications, ...legacyVerifications].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={withAt(`/lists/${id}/stats`, at)}>
          &larr; back to stats
        </Link>
        <TimeMachine
          at={at}
          trackingStart={data.timeMachine?.trackingStart ?? null}
          beforeTracking={data.timeMachine !== null && data.timeMachine.state === null}
        />
        <h2 style={{ margin: "14px 0 4px" }}>{player.username}</h2>
        <div className="msg ok" style={{ marginTop: 0, marginBottom: "20px" }}>
          {player.points.toFixed(2)} pts on this list
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
