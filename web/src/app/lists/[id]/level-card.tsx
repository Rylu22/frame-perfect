"use client";

import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { tierByKey } from "@/lib/tiers";

export type LevelCardData = {
  id: string;
  name: string;
  difficulty: string;
  verifier_username: string | null;
  publisher: string | null;
  points: number;
  image_url: string | null;
  victor_count: number;
  description: string;
};

type Completion = { role: "verifier" | "victor"; user_id: string; username: string; video_url: string | null };

export default function LevelCard({
  level,
  index,
  actions,
  cardProps,
  completed,
}: {
  level: LevelCardData;
  index: number;
  actions?: ReactNode;
  cardProps?: HTMLAttributes<HTMLDivElement>;
  completed?: boolean;
}) {
  const tier = tierByKey(level.difficulty);
  const { className: extraClassName, ...restCardProps } = cardProps ?? {};

  const [open, setOpen] = useState(false);
  const [completions, setCompletions] = useState<Completion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && completions === null) {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("get_level_completions", { p_level_id: level.id });
      setCompletions((data as Completion[] | null) ?? []);
      setLoading(false);
    }
  }

  return (
    <div className={`level-card ${extraClassName ?? ""}`.trim()} {...restCardProps}>
      <div className="pos-badge">
        <span>{index + 1}</span>
      </div>
      {level.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- image_url is a locally-generated data URI, not a remote asset
        <img className="lv-thumb" src={level.image_url} alt="" />
      ) : (
        <div className="lv-thumb-empty" />
      )}
      <div className="lv-info">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {completed && (
            <span title="You've completed this level" style={{ color: "var(--ok)" }}>
              &#10003;
            </span>
          )}
          <span
            className="lv-name"
            style={{ cursor: "pointer", textDecoration: "underline dotted" }}
            title="Show description"
            onClick={() => setDescOpen((v) => !v)}
          >
            {level.name}
          </span>
          {tier && (
            <span className="tier-tag" style={{ "--tier": tier.color } as CSSProperties}>
              {tier.label}
            </span>
          )}
          <span
            className="victor-count"
            style={{ cursor: "pointer", textDecoration: "underline dotted" }}
            onClick={toggleOpen}
          >
            {level.victor_count} victor{level.victor_count === 1 ? "" : "s"}
          </span>
        </div>
        <div className="lv-meta">
          Verified by {level.verifier_username ?? "—"} &middot; Published by{" "}
          {level.publisher || "—"} &middot; {level.points.toFixed(2)} pts
        </div>

        {descOpen && (
          <div className="empty-note" style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
            {level.description.trim() || "No description yet."}
          </div>
        )}

        {open && (
          <div style={{ marginTop: "8px" }}>
            {loading ? (
              <div className="empty-note">Loading...</div>
            ) : completions && completions.length > 0 ? (
              completions.map((c) => (
                <div key={`${c.role}-${c.user_id}`} className="editor-row" style={{ marginBottom: "4px" }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{c.username}</span>{" "}
                    <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                      {c.role === "verifier" ? "verifier" : "victor"}
                    </span>
                  </span>
                  {c.video_url && (
                    <a
                      className="icon-btn"
                      href={c.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Watch clip"
                    >
                      &#9654;
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-note">No verifier or victors yet.</div>
            )}
          </div>
        )}
      </div>
      {actions && <div className="lv-actions">{actions}</div>}
    </div>
  );
}
