import Link from "next/link";
import LevelCard, { type LevelCardData } from "./level-card";

export default function Viewer({
  listId,
  listName,
  ownerUsername,
  targetSize,
  levels,
  isLoggedIn,
  canSubmit,
  myPoints,
  myCompleted,
}: {
  listId: string;
  listName: string;
  ownerUsername: string;
  targetSize: number;
  levels: LevelCardData[];
  isLoggedIn: boolean;
  canSubmit: boolean;
  myPoints: number | null;
  myCompleted: number | null;
}) {
  return (
    <div>
      <h2 style={{ margin: "14px 0 6px" }}>{listName}</h2>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
        <div className="progress-chip">
          {levels.length} / {targetSize} levels
        </div>
        <div style={{ color: "var(--muted)", fontSize: "13px" }}>by {ownerUsername}</div>
      </div>

      {isLoggedIn ? (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
          <div className="progress-chip">
            {myCompleted ?? 0} / {levels.length} levels completed
          </div>
          <div className="progress-chip">Your points: {(myPoints ?? 0).toFixed(2)}</div>
          {canSubmit && (
            <Link className="btn btn-primary btn-sm" href={`/lists/${listId}/submit`}>
              Submit a Record
            </Link>
          )}
        </div>
      ) : (
        <div className="msg" style={{ marginBottom: "20px" }}>
          <Link href="/auth?mode=login" style={{ color: "var(--accent-2)" }}>
            Log in
          </Link>{" "}
          to submit a record or see your points on this list.
        </div>
      )}

      {levels.length === 0 ? (
        <div className="empty-note">This list has no levels yet.</div>
      ) : (
        levels.map((lv, i) => <LevelCard key={lv.id} level={lv} index={i} />)
      )}
    </div>
  );
}
