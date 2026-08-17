"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "level" | "rank";
type Curve = "linear" | "exponential";

export default function PointsConfigForm({
  listId,
  targetSize,
  pointsMode,
  rankPoints,
  topLevelName,
  bottomLevelName,
}: {
  listId: string;
  targetSize: number;
  pointsMode: Mode;
  rankPoints: Record<string, number>;
  topLevelName: string | null;
  bottomLevelName: string | null;
}) {
  const [mode, setMode] = useState<Mode>(pointsMode);
  const [rankValues, setRankValues] = useState<string[]>(() =>
    Array.from({ length: targetSize }, (_, i) => {
      const v = rankPoints[String(i + 1)];
      return typeof v === "number" ? v.toFixed(2) : "0.00";
    }),
  );
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [autofillTop, setAutofillTop] = useState("");
  const [autofillBottom, setAutofillBottom] = useState("");
  const [autofillCurve, setAutofillCurve] = useState<Curve>("exponential");
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  function applyAutofill() {
    const top = parseFloat(autofillTop);
    const bottom = parseFloat(autofillBottom);
    if (Number.isNaN(top) || top < 0) {
      setAutofillError("Enter points for #1.");
      return;
    }
    if (Number.isNaN(bottom) || bottom < 0) {
      setAutofillError(`Enter points for #${targetSize}.`);
      return;
    }

    const n = targetSize;
    const next = rankValues.map((_, i) => {
      const rank = i + 1;
      let v: number;
      if (n === 1) {
        v = top;
      } else {
        const t = (rank - 1) / (n - 1); // 0 at #1, 1 at #last
        if (autofillCurve === "exponential" && top > 0 && bottom > 0) {
          v = top * Math.pow(bottom / top, t); // geometric decay from #1 to #last
        } else {
          v = top + (bottom - top) * t; // linear
        }
      }
      return (Math.round(v * 100) / 100).toFixed(2);
    });
    setRankValues(next);
    setAutofillOpen(false);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const supabase = createClient();

    const update: { points_mode: Mode; rank_points?: Record<string, number> } = { points_mode: mode };
    if (mode === "rank") {
      const rp: Record<string, number> = {};
      rankValues.forEach((v, i) => {
        let n = parseFloat(v);
        if (Number.isNaN(n) || n < 0) n = 0;
        rp[String(i + 1)] = Math.round(n * 100) / 100;
      });
      update.rank_points = rp;
    }

    const { error } = await supabase.from("lists").update(update).eq("id", listId);
    setSaving(false);
    setMsg(error ? { text: error.message, error: true } : { text: "Points configuration saved.", error: false });
  }

  return (
    <div className="card-panel">
      <div className="choice-row">
        <div className={`choice-opt ${mode === "level" ? "active" : ""}`} onClick={() => setMode("level")}>
          Level-Locked
        </div>
        <div className={`choice-opt ${mode === "rank" ? "active" : ""}`} onClick={() => setMode("rank")}>
          Rank-Locked
        </div>
      </div>

      {mode === "level" ? (
        <div className="msg">Each level keeps its own fixed point value, set when you add or edit it.</div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span className="eyebrow">points per rank</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setAutofillOpen(true)}>
              Autofill
            </button>
          </div>
          <div style={{ marginBottom: "14px" }}>
            {rankValues.map((v, i) => (
              <div className="pc-rank-row" key={i}>
                <span className="pc-label">#{i + 1}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={v}
                  onChange={(e) => {
                    const next = [...rankValues];
                    next[i] = e.target.value;
                    setRankValues(next);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Points Config"}
      </button>
      {msg && <div className={`msg ${msg.error ? "error" : "ok"}`}>{msg.text}</div>}

      {autofillOpen && (
        <div
          className="modal-backdrop active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAutofillOpen(false);
          }}
        >
          <div className="modal">
            <h3>Autofill Rank Points</h3>
            <div className="row2">
              <div className="field">
                <label>#1 {topLevelName ? `(currently ${topLevelName})` : "(no level)"}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={autofillTop}
                  onChange={(e) => setAutofillTop(e.target.value)}
                />
              </div>
              <div className="field">
                <label>
                  #{targetSize} {bottomLevelName ? `(currently ${bottomLevelName})` : "(no level)"}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={autofillBottom}
                  onChange={(e) => setAutofillBottom(e.target.value)}
                />
              </div>
            </div>
            <div className="choice-row">
              <div
                className={`choice-opt ${autofillCurve === "linear" ? "active" : ""}`}
                onClick={() => setAutofillCurve("linear")}
              >
                Linear
              </div>
              <div
                className={`choice-opt ${autofillCurve === "exponential" ? "active" : ""}`}
                onClick={() => setAutofillCurve("exponential")}
              >
                Exponential
              </div>
            </div>
            <div className={`msg ${autofillError ? "error" : ""}`}>{autofillError}</div>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setAutofillOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={applyAutofill}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
