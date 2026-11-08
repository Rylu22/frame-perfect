"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, useIsClient } from "@/components/local-time";

type Cause = {
  type?: "baseline" | "created" | "add" | "delete" | "move" | "update";
  level_id?: string;
  level_name?: string;
  from?: number;
  to?: number;
};

type HistoryRow = {
  at: string;
  status: "active" | "legacy" | "absent";
  pos: number | null;
  prev_status: "active" | "legacy" | "absent" | null;
  prev_pos: number | null;
  cause: Cause | null;
};

function describeCause(cause: Cause | null): string | null {
  if (!cause?.level_name) return null;
  switch (cause.type) {
    case "add":
      return `${cause.level_name} was added at #${cause.to}`;
    case "move":
      return `${cause.level_name} was moved from #${cause.from} to #${cause.to}`;
    case "delete":
      return `${cause.level_name} was removed from #${cause.from}`;
    default:
      return null;
  }
}

function describe(row: HistoryRow, levelId: string): string {
  const cause = row.cause;
  const self = cause?.level_id === levelId;
  const because = describeCause(cause);
  const suffix = !self && because ? ` when ${because}` : "";

  if (row.prev_status === null) {
    if (cause?.type === "baseline") {
      return row.status === "legacy"
        ? "Already on the legacy list when history tracking began"
        : `Already at #${row.pos} when history tracking began`;
    }
    if (row.status === "legacy") return "Appeared on the legacy list";
    return self || cause?.type === "add"
      ? `Placed at #${row.pos}`
      : `Appeared at #${row.pos}`;
  }

  if (
    row.status === "active" &&
    row.prev_status === "active" &&
    row.pos !== null &&
    row.prev_pos !== null
  ) {
    if (self) {
      return row.pos > row.prev_pos
        ? `Moved down from #${row.prev_pos} to #${row.pos}`
        : `Moved up from #${row.prev_pos} to #${row.pos}`;
    }
    return row.pos > row.prev_pos
      ? `Pushed down from #${row.prev_pos} to #${row.pos}${suffix}`
      : `Moved up from #${row.prev_pos} to #${row.pos}${suffix}`;
  }

  if (row.status === "active") {
    return row.prev_status === "legacy"
      ? `Returned from the legacy list at #${row.pos}`
      : `Placed at #${row.pos}`;
  }

  const from = row.prev_pos !== null ? ` from #${row.prev_pos}` : "";
  if (row.status === "legacy") {
    return `Pushed off the list${from} into the legacy list${suffix}`;
  }
  return `Removed from the list${from}`;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 0)}m`;
}

function statusLabel(row: HistoryRow) {
  if (row.status === "active") return `#${row.pos}`;
  if (row.status === "legacy") return "Legacy";
  return "Off list";
}

export default function HistoryButton({
  listId,
  levelId,
  levelName,
}: {
  listId: string;
  levelId: string;
  levelName: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const isClient = useIsClient();

  async function openHistory() {
    setOpen(true);
    if (rows !== null) return;
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("get_level_history", {
      p_list_id: listId,
      p_level_id: levelId,
    });
    if (rpcError) setError(rpcError.message);
    setFetchedAt(Date.now());
    setRows((data as HistoryRow[] | null) ?? []);
  }

  return (
    <>
      <span
        className="info-btn"
        title="Placement history"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          openHistory();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openHistory();
          }
        }}
      >
        i
      </span>

      {open &&
        createPortal(
          <div
            className="modal-backdrop active"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="modal">
              <h3>Placement history — {levelName}</h3>
              {error ? (
                <div className="msg error">{error}</div>
              ) : rows === null ? (
                <div className="empty-note">Loading...</div>
              ) : rows.length === 0 ? (
                <div className="empty-note">
                  No placement history recorded for this level yet.
                </div>
              ) : (
                <div className="history-list">
                  {rows.map((row, i) => {
                    const next = rows[i + 1];
                    const end = next ? new Date(next.at).getTime() : fetchedAt;
                    const held = formatDuration(
                      end - new Date(row.at).getTime(),
                    );
                    return (
                      <div className="history-row" key={`${row.at}-${i}`}>
                        <span className={`history-pos ${row.status}`}>
                          {statusLabel(row)}
                        </span>
                        <div className="history-body">
                          <div className="history-desc">
                            {describe(row, levelId)}
                          </div>
                          <div className="history-time">
                            {isClient
                              ? formatDateTime(row.at)
                              : row.at.slice(0, 10)}
                            {row.status !== "absent" && (
                              <>
                                {" → "}
                                {next
                                  ? isClient
                                    ? formatDateTime(next.at)
                                    : next.at.slice(0, 10)
                                  : "present"}
                                {isClient && ` · ${held}`}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="modal-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
