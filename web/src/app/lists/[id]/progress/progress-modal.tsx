"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeImageToDataUrl } from "@/lib/image";
import type { ProgressBlock } from "./progress-board";

type Mode = "beating" | "verifying";

export default function ProgressModal({
  onClose,
  onSaved,
  listId,
  levels,
  editingBlock,
}: {
  onClose: () => void;
  onSaved: () => void;
  listId: string;
  levels: { id: string; name: string; position: number }[];
  editingBlock: ProgressBlock | null;
}) {
  const [mode, setMode] = useState<Mode>(editingBlock?.mode ?? "beating");
  const [levelId, setLevelId] = useState(editingBlock?.levelId ?? levels[0]?.id ?? "");
  const [levelName, setLevelName] = useState(editingBlock?.mode === "verifying" ? editingBlock.levelName : "");
  const [estimatedRank, setEstimatedRank] = useState(
    editingBlock?.mode === "verifying" && editingBlock.rank ? String(editingBlock.rank) : "",
  );
  const [permissionFrom, setPermissionFrom] = useState(editingBlock?.permissionFrom ?? "");
  const [publisher, setPublisher] = useState(editingBlock?.publisher ?? "");
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(editingBlock?.thumbnailUrl ?? null);
  const [dragActive, setDragActive] = useState(false);
  const [note1, setNote1] = useState(editingBlock?.note1 ?? "");
  const [note2, setNote2] = useState(editingBlock?.note2 ?? "");
  const [note3, setNote3] = useState(editingBlock?.note3 ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const payload: Record<string, unknown> = {
      list_id: listId,
      mode,
      note1,
      note2,
      note3,
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
      payload.permission_from = "";
      payload.publisher = "";
      payload.thumbnail_url = null;
    } else {
      const trimmedName = levelName.trim();
      const rank = parseInt(estimatedRank, 10);
      const trimmedPermission = permissionFrom.trim();
      const trimmedPublisher = publisher.trim();
      if (!trimmedName) {
        setError("Enter the name of the level you're verifying.");
        return;
      }
      if (!Number.isInteger(rank) || rank <= 0) {
        setError("Enter your estimated rank.");
        return;
      }
      if (!trimmedPermission) {
        setError("Enter who gave you permission to verify (the level's victor or verifier).");
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
      payload.permission_from = trimmedPermission;
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

            <div className="field">
              <label htmlFor="pgPermission">Permission from (level&apos;s victor or verifier)</label>
              <input
                type="text"
                id="pgPermission"
                value={permissionFrom}
                onChange={(e) => setPermissionFrom(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="pgNote1">Note 1</label>
          <textarea id="pgNote1" rows={2} value={note1} onChange={(e) => setNote1(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pgNote2">Note 2</label>
          <textarea id="pgNote2" rows={2} value={note2} onChange={(e) => setNote2(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pgNote3">Note 3</label>
          <textarea id="pgNote3" rows={2} value={note3} onChange={(e) => setNote3(e.target.value)} />
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
