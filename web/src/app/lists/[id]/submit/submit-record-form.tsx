"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIERS } from "@/lib/tiers";

type RecordType = "victor" | "verifier";

export default function SubmitRecordForm({
  listId,
  levels,
}: {
  listId: string;
  levels: { id: string; name: string; position: number }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<RecordType>("victor");
  const [videoUrl, setVideoUrl] = useState("");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [levelName, setLevelName] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setMsg(null);
    const trimmedVideo = videoUrl.trim();
    if (trimmedVideo && !/^https?:\/\//i.test(trimmedVideo)) {
      setMsg({ text: "Video link must start with http:// or https://", error: true });
      return;
    }

    const record: Record<string, unknown> = {
      list_id: listId,
      type,
      video_url: trimmedVideo || null,
      status: "pending",
    };

    if (type === "victor") {
      if (!levelId) {
        setMsg({ text: "Choose which level you beat.", error: true });
        return;
      }
      record.level_id = levelId;
    } else {
      const trimmedName = levelName.trim();
      if (!trimmedName) {
        setMsg({ text: "Enter the name of the level you verified.", error: true });
        return;
      }
      if (!difficulty) {
        setMsg({ text: "Choose a difficulty.", error: true });
        return;
      }
      record.level_name = trimmedName;
      record.difficulty = difficulty;
    }

    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    record.submitted_by = user?.id;

    const { error } = await supabase.from("records").insert(record);
    setSubmitting(false);

    if (error) {
      setMsg({ text: error.message, error: true });
      return;
    }

    setMsg({ text: "Record submitted! The list moderator will review it.", error: false });
    setTimeout(() => router.push(`/lists/${listId}`), 1200);
  }

  return (
    <div>
      <div className="choice-row">
        <div className={`choice-opt ${type === "victor" ? "active" : ""}`} onClick={() => setType("victor")}>
          Victor
        </div>
        <div className={`choice-opt ${type === "verifier" ? "active" : ""}`} onClick={() => setType("verifier")}>
          Verifier
        </div>
      </div>

      {type === "victor" ? (
        <div className="field">
          <label htmlFor="srLevelSelect">Which level did you beat?</label>
          {levels.length === 0 ? (
            <select id="srLevelSelect" disabled>
              <option>No levels on this list yet</option>
            </select>
          ) : (
            <select id="srLevelSelect" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
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
          <div className="field">
            <label htmlFor="srLevelName">Level name</label>
            <input type="text" id="srLevelName" value={levelName} onChange={(e) => setLevelName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="srDifficulty">Difficulty</label>
            <select id="srDifficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Select difficulty</option>
              {TIERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="srVideoUrl">Video link (optional)</label>
        <input type="text" id="srVideoUrl" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      </div>

      <button className="btn btn-primary btn-block" onClick={submit} disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Record"}
      </button>
      {msg && <div className={`msg ${msg.error ? "error" : "ok"}`}>{msg.text}</div>}
    </div>
  );
}
