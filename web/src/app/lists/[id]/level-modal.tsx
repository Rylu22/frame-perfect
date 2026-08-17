"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIERS } from "@/lib/tiers";
import type { LevelCardData } from "./level-card";

export type EditingLevel = LevelCardData & { verifier_id: string | null; position: number };

const MAX_IMAGE_WIDTH = 320;

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = String(e.target?.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Mounted by the parent only while the modal should be open (see Builder),
// so all state below can initialize straight from props — no effect-based
// reset needed. Give the parent's conditional render a `key` tied to
// editingLevel so switching targets while mounted still starts fresh.
export type LevelPrefill = { name: string; difficulty: string; verifier: string };

export default function LevelModal({
  onClose,
  onSaved,
  listId,
  ownerUsername,
  pointsMode,
  defaultPosition,
  editingLevel,
  prefill,
}: {
  onClose: () => void;
  onSaved: () => void;
  listId: string;
  ownerUsername: string;
  pointsMode: "level" | "rank";
  defaultPosition: number;
  editingLevel: EditingLevel | null;
  prefill?: LevelPrefill;
}) {
  const [name, setName] = useState(editingLevel?.name ?? prefill?.name ?? "");
  const [difficulty, setDifficulty] = useState(editingLevel?.difficulty ?? prefill?.difficulty ?? "");
  const [verifier, setVerifier] = useState(editingLevel?.verifier_username ?? prefill?.verifier ?? "");
  const [publisher, setPublisher] = useState(editingLevel?.publisher ?? "");
  const [points, setPoints] = useState(editingLevel ? editingLevel.points.toFixed(2) : "0.00");
  const [position, setPosition] = useState(editingLevel?.position ?? defaultPosition);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(editingLevel?.image_url ?? null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImageDataUrl(dataUrl);
    } catch {
      setError("Couldn't read that image.");
    }
  }

  async function submit() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give the level a name.");
      return;
    }
    if (!difficulty) {
      setError("Choose a difficulty.");
      return;
    }

    let parsedPoints = parseFloat(points);
    if (Number.isNaN(parsedPoints) || parsedPoints < 0) parsedPoints = 0;
    parsedPoints = Math.round(parsedPoints * 100) / 100;

    setSaving(true);
    const supabase = createClient();

    let verifierId: string | null = null;
    const trimmedVerifier = verifier.trim();
    if (trimmedVerifier) {
      const { data: match } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", trimmedVerifier)
        .maybeSingle();

      if (!match) {
        setError(`"${trimmedVerifier}" isn't a registered account. The verifier must sign up first.`);
        setSaving(false);
        return;
      }
      if (match.username.toLowerCase() === ownerUsername.toLowerCase()) {
        setError(
          "The list moderator can't be the verifier. Use a separate account to submit and accept that verification.",
        );
        setSaving(false);
        return;
      }
      verifierId = match.id;
    }

    const rpcName = editingLevel ? "update_level" : "add_level";
    const rpcArgs = editingLevel
      ? {
          p_level_id: editingLevel.id,
          p_position: position,
          p_name: trimmedName,
          p_difficulty: difficulty,
          p_verifier_id: verifierId,
          p_publisher: publisher.trim(),
          p_points: parsedPoints,
          p_image_url: imageDataUrl,
        }
      : {
          p_list_id: listId,
          p_position: position,
          p_name: trimmedName,
          p_difficulty: difficulty,
          p_verifier_id: verifierId,
          p_publisher: publisher.trim(),
          p_points: parsedPoints,
          p_image_url: imageDataUrl,
        };

    const { error: rpcError } = await supabase.rpc(rpcName, rpcArgs);
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
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
        <h3>{editingLevel ? "Edit Level" : prefill ? "Add Level (from verification record)" : "Add Level"}</h3>

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
          {imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- locally-generated data URI preview
            <img src={imageDataUrl} alt="" />
          ) : (
            <span>Click or drop an image (optional)</span>
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
          <label htmlFor="lvName">Level name</label>
          <input type="text" id="lvName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="lvDifficulty">Difficulty</label>
            <select id="lvDifficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Select difficulty</option>
              {TIERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lvPosition">Position</label>
            <input
              type="number"
              id="lvPosition"
              min={1}
              value={position}
              onChange={(e) => setPosition(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="lvVerifier">Verifier (existing account, optional)</label>
          <input type="text" id="lvVerifier" value={verifier} onChange={(e) => setVerifier(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="lvPublisher">Publisher</label>
          <input type="text" id="lvPublisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </div>

        {pointsMode === "level" ? (
          <div className="field">
            <label htmlFor="lvPoints">Points</label>
            <input type="number" id="lvPoints" min={0} step="0.01" value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
        ) : (
          <div className="msg" style={{ marginTop: 0, marginBottom: "14px" }}>
            This list is rank-locked — points come from Points Config, not this level.
          </div>
        )}

        <div className={`msg ${error ? "error" : ""}`}>{error}</div>

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : editingLevel ? "Save Changes" : "Add Level"}
          </button>
        </div>
      </div>
    </div>
  );
}
