"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LevelCard, { type LevelCardData } from "./level-card";
import LevelModal, { type EditingLevel } from "./level-modal";
import ConfirmDialog from "@/components/confirm-dialog";

// `points` is the *display* value (rank-derived when the list is
// rank-locked); `raw_points` is always the level's own stored points
// column, which is what the edit modal should prefill and resubmit even
// when the Points field is hidden in rank-locked mode.
export type BuilderLevel = LevelCardData & { verifier_id: string | null; position: number; raw_points: number };

const NAV_SECTIONS: { slug: string; label: string }[] = [
  { slug: "settings", label: "Settings" },
  { slug: "records", label: "Record Feed" },
  { slug: "stats", label: "Stats Viewer" },
  { slug: "legacy", label: "Legacy List" },
  { slug: "points", label: "Points Config" },
];

export default function Builder({
  listId,
  listName,
  targetSize,
  pointsMode,
  ownerUsername,
  levels,
}: {
  listId: string;
  listName: string;
  targetSize: number;
  pointsMode: "level" | "rank";
  ownerUsername: string;
  levels: BuilderLevel[];
}) {
  const router = useRouter();
  // Derived state, reset whenever the server-fetched `levels` prop changes
  // identity (e.g. after router.refresh()) — see React's "adjusting state
  // when a prop changes" pattern; avoids the effect+setState anti-pattern.
  const [prevLevelsProp, setPrevLevelsProp] = useState(levels);
  const [orderedLevels, setOrderedLevels] = useState(levels);
  if (levels !== prevLevelsProp) {
    setPrevLevelsProp(levels);
    setOrderedLevels(levels);
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<EditingLevel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuilderLevel | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  function openAdd() {
    setEditingLevel(null);
    setModalOpen(true);
  }
  function openEdit(level: BuilderLevel) {
    // Prefill the modal with the level's real stored points, not the
    // rank-derived display value shown on the card.
    setEditingLevel({ ...level, points: level.raw_points });
    setModalOpen(true);
  }
  function handleSaved() {
    setModalOpen(false);
    setEditingLevel(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_level", { p_level_id: deleteTarget.id });
    setDeleteTarget(null);
    if (error) setActionError(error.message);
    router.refresh();
  }

  async function handleDrop(targetId: string) {
    const srcId = dragIdRef.current;
    dragIdRef.current = null;
    setDragOverId(null);
    if (!srcId || srcId === targetId) return;

    const current = [...orderedLevels];
    const fromIdx = current.findIndex((l) => l.id === srcId);
    const toIdx = current.findIndex((l) => l.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    setOrderedLevels(current);

    const supabase = createClient();
    const { error } = await supabase.rpc("reorder_levels", {
      p_list_id: listId,
      p_ordered_ids: current.map((l) => l.id),
    });
    if (error) setActionError(error.message);
    router.refresh();
  }

  return (
    <>
      <div className="builder-head">
        <div>
          <h2>{listName}</h2>
          <div className="progress-chip">
            {orderedLevels.length} / {targetSize} levels
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", rowGap: "12px", flexWrap: "wrap" }}>
          {NAV_SECTIONS.map((s) => (
            <Link key={s.slug} className="btn btn-ghost" href={`/lists/${listId}/${s.slug}`}>
              {s.label}
            </Link>
          ))}
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Level
          </button>
        </div>
      </div>

      <div className={`msg ${actionError ? "error" : ""}`}>{actionError}</div>

      {orderedLevels.length === 0 ? (
        <div className="empty-note">No levels yet. Add your first one.</div>
      ) : (
        orderedLevels.map((level, i) => (
          <LevelCard
            key={level.id}
            level={level}
            index={i}
            cardProps={{
              draggable: true,
              className: dragOverId === level.id ? "drag-over" : "",
              onDragStart: () => {
                dragIdRef.current = level.id;
              },
              onDragEnd: () => setDragOverId(null),
              onDragOver: (e) => {
                e.preventDefault();
                setDragOverId(level.id);
              },
              onDragLeave: () => setDragOverId((id) => (id === level.id ? null : id)),
              onDrop: (e) => {
                e.preventDefault();
                handleDrop(level.id);
              },
            }}
            actions={
              <>
                <div className="icon-btn" title="Edit" onClick={() => openEdit(level)}>
                  &#9998;
                </div>
                <div className="icon-btn btn-danger" title="Delete" onClick={() => setDeleteTarget(level)}>
                  &#10005;
                </div>
              </>
            }
          />
        ))
      )}

      {modalOpen && (
        <LevelModal
          key={editingLevel?.id ?? "new"}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          listId={listId}
          ownerUsername={ownerUsername}
          pointsMode={pointsMode}
          defaultPosition={orderedLevels.length + 1}
          editingLevel={editingLevel}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Remove "${deleteTarget?.name ?? "this level"}" from the list? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
