"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tierByKey } from "@/lib/tiers";
import LevelModal from "../level-modal";

export type FeedRecord = {
  id: string;
  submitted_by: string;
  submitter_username: string;
  type: "victor" | "verifier";
  level_id: string | null;
  level_name: string | null;
  difficulty: string | null;
  video_url: string | null;
  status: "pending" | "accepted" | "declined";
  decline_reason: string | null;
};

export default function RecordFeed({
  listId,
  listName,
  ownerUsername,
  pointsMode,
  levelCount,
  records,
}: {
  listId: string;
  listName: string;
  ownerUsername: string;
  pointsMode: "level" | "rank";
  levelCount: number;
  records: FeedRecord[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fulfilling, setFulfilling] = useState<FeedRecord | null>(null);
  const [declineTarget, setDeclineTarget] = useState<FeedRecord | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function acceptVictor(record: FeedRecord) {
    setError(null);
    setBusyId(record.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_victor_record", { p_record_id: record.id });
    setBusyId(null);
    if (error) setError(error.message);
    router.refresh();
  }

  async function submitDecline() {
    if (!declineTarget) return;
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("records")
      .update({ status: "declined", decline_reason: declineReason.trim() })
      .eq("id", declineTarget.id);
    setDeclineTarget(null);
    setDeclineReason("");
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div>
      <h2 style={{ margin: "14px 0 18px" }}>Record Feed — {listName}</h2>
      <div className={`msg ${error ? "error" : ""}`}>{error}</div>

      {records.length === 0 ? (
        <div className="empty-note">No records submitted yet.</div>
      ) : (
        records.map((r) => {
          const tier = r.difficulty ? tierByKey(r.difficulty) : null;
          return (
            <div className="record-card" key={r.id}>
              <div className="record-top">
                <div>
                  <span className="who">{r.submitter_username}</span>{" "}
                  <span className={`type-tag ${r.type}`}>{r.type}</span>
                </div>
                <span className={`status-tag ${r.status}`}>{r.status}</span>
              </div>
              <div className="record-meta">
                Level: {r.level_name || "—"} {tier ? `· ${tier.label}` : ""} &middot;{" "}
                {r.video_url ? (
                  <a href={r.video_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>
                    Watch clip &#8599;
                  </a>
                ) : (
                  <span style={{ color: "var(--muted)" }}>No video submitted</span>
                )}
              </div>
              {r.status === "declined" && r.decline_reason && (
                <div className="decline-reason">Declined: {r.decline_reason}</div>
              )}
              {r.status === "pending" && (
                <div className="record-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busyId === r.id}
                    onClick={() => (r.type === "victor" ? acceptVictor(r) : setFulfilling(r))}
                  >
                    Accept
                  </button>
                  <button className="btn btn-danger" onClick={() => setDeclineTarget(r)}>
                    Decline
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {fulfilling && (
        <LevelModal
          key={fulfilling.id}
          onClose={() => setFulfilling(null)}
          onSaved={async () => {
            const supabase = createClient();
            await supabase.from("records").update({ status: "accepted" }).eq("id", fulfilling.id);
            setFulfilling(null);
            router.refresh();
          }}
          listId={listId}
          ownerUsername={ownerUsername}
          pointsMode={pointsMode}
          defaultPosition={levelCount + 1}
          editingLevel={null}
          prefill={{
            name: fulfilling.level_name ?? "",
            difficulty: fulfilling.difficulty ?? "",
            verifier: fulfilling.submitter_username,
          }}
        />
      )}

      {declineTarget && (
        <div
          className="modal-backdrop active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeclineTarget(null);
          }}
        >
          <div className="modal">
            <h3>Decline Record</h3>
            <div className="field">
              <label htmlFor="declineReason">Reason</label>
              <textarea
                id="declineReason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setDeclineTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={submitDecline}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
