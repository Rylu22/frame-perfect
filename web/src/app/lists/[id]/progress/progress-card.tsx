"use client";

import type { ReactNode } from "react";
import type { ProgressBlock } from "./progress-board";

export default function ProgressCard({ block, actions }: { block: ProgressBlock; actions?: ReactNode }) {
  const header =
    block.mode === "beating"
      ? `${block.levelName} (Top ${block.rank ?? "?"})`
      : `${block.levelName} (Verifying Top ${block.rank ?? "?"})`;

  const notes = [block.note1, block.note2, block.note3].filter((n) => n.trim());

  return (
    <div className="level-card">
      {block.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail_url is a locally-generated data URI, not a remote asset
        <img className="lv-thumb" src={block.thumbnailUrl} alt="" />
      ) : (
        <div className="lv-thumb-empty" />
      )}
      <div className="lv-info">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="lv-name">{header}</span>
        </div>
        <div className="lv-meta">
          By {block.username} &middot; {block.mode === "beating" ? "Beating" : "Verifying"}
          {block.mode === "verifying" && (
            <>
              {" "}
              &middot; Publisher: {block.publisher || "—"} &middot; Permission from:{" "}
              {block.permissionFrom || "—"}
            </>
          )}
        </div>

        {notes.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            {notes.map((note, i) => (
              <div key={i} className="empty-note" style={{ marginBottom: "4px", whiteSpace: "pre-wrap" }}>
                {note}
              </div>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="lv-actions">{actions}</div>}
    </div>
  );
}
