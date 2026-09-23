"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeImageToDataUrl } from "@/lib/image";
import type { ProgressBlock } from "./progress-board";
import RunBar from "./run-bar";

type Mode = "beating" | "verifying";
type RunDraft = { start: string; end: string };
const MAX_RUNS = 3;

export default function ProgressModal({
  onClose,
  onSaved,
  listId,
  levels,
  editingBlock,
  nextPosition,
}: {
  onClose: () => void;
  onSaved: () => void;
  listId: string;
  levels: { id: string; name: string; position: number }[];
  editingBlock: ProgressBlock | null;
  nextPosition: number;
}) {
  const [mode, setMode] = useState<Mode>(editingBlock?.mode ?? "beating");
  const [levelId, setLevelId] = useState(editingBlock?.levelId ?? levels[0]?.id ?? "");
  const [levelName, setLevelName] = useState(editingBlock?.mode === "verifying" ? editingBlock.levelName : "");
  const [estimatedRank, setEstimatedRank] = useState(
    editingBlock?.mode === "verifying" && editingBlock.rank ? String(editingBlock.rank) : "",
  );
  const [publisher, setPublisher] = useState(editingBlock?.publisher ?? "");
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(editingBlock?.thumbnailUrl ?? null);
  const [dragActive, setDragActive] = useState(false);
  const [runs, setRuns] = useState<RunDraft[]>(
    editingBlock?.runs.map((r) => ({ start: String(r.start), end: String(r.end) })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addRun() {
    setRuns((prev) => (prev.length >= MAX_RUNS ? prev : [...prev, { start: "", end: "" }]));
  }
  function removeRun(i: number) {
    setRuns((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateRun(i: number, field: "start" | "end", value: string) {
    setRuns((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setThumbnailDataUrl(dataUrl);
    } catch {
      setError("Couldn't read that image.");
    }
  }

  async function submit() {
    setError(null);

    const parsedRuns: { start: number; end: number }[] = [];
    for (let i = 0; i < runs.length; i++) {
      const start = parseInt(runs[i].start, 10);
      const end = parseInt(runs[i].end, 10);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 100 || start >= end) {
        setError(`Run ${i + 1}: enter a valid range from 0% to 100% (start below end).`);
        return;
      }
      parsedRuns.push({ start, end });
    }

    const payload: Record<string, unknown> = {
      list_id: listId,
      mode,
      runs: parsedRuns,
      updated_at: new Date().toISOString(),
    };

    if (mode === "beating") {
      if (!levelId) {
        setError("Choose which level you're beating.");
        return;
      }
      payload.level_id = levelId;
      payload.level_name = null;
      payload.estimated_rank = null;
      payload.publisher = "";
      payload.thumbnail_url = null;
    } else {
      const trimmedName = levelName.trim();
      const rank = parseInt(estimatedRank, 10);
      const trimmedPublisher = publisher.trim();
      if (!trimmedName) {
        setError("Enter the name of the level you're verifying.");
        return;
      }
      if (!Number.isInteger(rank) || rank <= 0) {
        setError("Enter your estimated rank.");
        return;
      }
      if (!trimmedPublisher) {
        setError("Enter the level's publisher.");
        return;
      }
      if (!thumbnailDataUrl) {
        setError("Add a thumbnail.");
        return;
      }
      payload.level_id = null;
      payload.level_name = trimmedName;
      payload.estimated_rank = rank;
      payload.publisher = trimmedPublisher;
      payload.thumbnail_url = thumbnailDataUrl;
    }

    setSaving(true);
    const supabase = createClient();

    if (editingBlock) {
      const { error: dbError } = await supabase.from("level_progress").update(payload).eq("id", editingBlock.id);
      setSaving(false);
      if (dbError) {
        setError(dbError.message);
        return;
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      payload.user_id = user?.id;
      payload.position = nextPosition;
      const { error: dbError } = await supabase.from("level_progress").insert(payload);
      setSaving(false);
      if (dbError) {
        setError(dbError.message);
        return;
      }
    }

    onSaved();
  }

  return (
    <div
      className="modal-backdrop active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <h3>{editingBlock ? "Edit Progress" : "Add Progress"}</h3>

        <div className="choice-row">
          <div className={`choice-opt ${mode === "beating" ? "active" : ""}`} onClick={() => setMode("beating")}>
            Beating
          </div>
          <div className={`choice-opt ${mode === "verifying" ? "active" : ""}`} onClick={() => setMode("verifying")}>
            Verifying
          </div>
        </div>

        {mode === "beating" ? (
          <div className="field">
            <label htmlFor="pgLevelSelect">Which level are you beating?</label>
            {levels.length === 0 ? (
              <select id="pgLevelSelect" disabled>
                <option>No levels on this list yet</option>
              </select>
            ) : (
              <select id="pgLevelSelect" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                {levels.map((lv) => (
                  <option key={lv.id} value={lv.id}>
                    #{lv.position} — {lv.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <>
            <div
              className={`dropzone ${dragActive ? "drag" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
              }}
            >
              {thumbnailDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- locally-generated data URI preview
                <img src={thumbnailDataUrl} alt="" />
              ) : (
                <span>Click or drop a thumbnail</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="pgLevelName">Level name</label>
              <input type="text" id="pgLevelName" value={levelName} onChange={(e) => setLevelName(e.target.value)} />
            </div>

            <div className="row2">
              <div className="field">
                <label htmlFor="pgPublisher">Publisher</label>
                <input type="text" id="pgPublisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="pgRank">Estimated rank</label>
                <input
                  type="number"
                  id="pgRank"
                  min={1}
                  value={estimatedRank}
                  onChange={(e) => setEstimatedRank(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label>Runs ({runs.length}/{MAX_RUNS})</label>
          {runs.map((run, i) => (
            <div key={i} className="run-row">
              <div className="run-row-inputs">
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={run.start}
                  onChange={(e) => updateRun(i, "start", e.target.value)}
                />
                <span>% &ndash;</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="100"
                  value={run.end}
                  onChange={(e) => updateRun(i, "end", e.target.value)}
                />
                <span>%</span>
                <div className="icon-btn btn-danger" title="Remove run" onClick={() => removeRun(i)}>
                  &#10005;
                </div>
              </div>
              <RunBar start={Number(run.start) || 0} end={Number(run.end) || 0} />
            </div>
          ))}
          {runs.length < MAX_RUNS && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={addRun}>
              + Add Run
            </button>
          )}
        </div>

        <div className={`msg ${error ? "error" : ""}`}>{error}</div>

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : editingBlock ? "Save Changes" : "Add Progress"}
          </button>
        </div>
      </div>
    </div>
  );
}
