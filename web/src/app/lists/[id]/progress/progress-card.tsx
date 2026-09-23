"use client";

import type { ReactNode } from "react";
import type { ProgressBlock } from "./progress-board";
import RunBar from "./run-bar";

export default function ProgressCard({ block, actions }: { block: ProgressBlock; actions?: ReactNode }) {
  const header =
    block.mode === "beating"
      ? `${block.levelName} (Top ${block.rank ?? "?"})`
      : `${block.levelName} (Verifying Top ${block.rank ?? "?"})`;

  return (
    <div className="progress-card">
      <div className="progress-card-top">
        {block.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URI / stored image, not a remote asset needing next/image
          <img className="progress-card-thumb" src={block.thumbnailUrl} alt="" />
        ) : (
          <div className="progress-card-thumb progress-card-thumb-empty" />
        )}
        <div className="progress-card-info">
          <div className="progress-card-name" title={header}>
            {header}
          </div>
          <div className="progress-card-meta">
            By {block.username} &middot; {block.mode === "beating" ? "Beating" : "Verifying"}
            {block.mode === "verifying" && <> &middot; {block.publisher || "—"}</>}
          </div>
        </div>
        {actions && <div className="progress-card-actions">{actions}</div>}
      </div>

      {block.runs.length > 0 && (
        <div className="progress-card-runs">
          {block.runs.map((run, i) => (
            <RunBar key={i} start={run.start} end={run.end} />
          ))}
        </div>
      )}
    </div>
  );
}
