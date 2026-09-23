"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/confirm-dialog";
import ProgressCard from "./progress-card";
import ProgressModal from "./progress-modal";

export type ProgressBlock = {
  id: string;
  userId: string;
  username: string;
  mode: "beating" | "verifying";
  levelId: string | null;
  levelName: string;
  rank: number | null;
  publisher: string;
  thumbnailUrl: string | null;
  runs: { start: number; end: number }[];
  position: number;
};

export default function ProgressBoard({
  listId,
  levels,
  blocks,
  currentUserId,
  readOnly,
  canReorder,
}: {
  listId: string;
  levels: { id: string; name: string; position: number }[];
  blocks: ProgressBlock[];
  currentUserId: string | null;
  readOnly: boolean;
  canReorder: boolean;
}) {
  const router = useRouter();
  // Derived state, reset whenever the server-fetched `blocks` prop changes
  // identity (e.g. after router.refresh()) — same pattern as Builder's
  // orderedLevels.
  const [prevBlocksProp, setPrevBlocksProp] = useState(blocks);
  const [orderedBlocks, setOrderedBlocks] = useState(blocks);
  if (blocks !== prevBlocksProp) {
    setPrevBlocksProp(blocks);
    setOrderedBlocks(blocks);
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ProgressBlock | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgressBlock | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  function openAdd() {
    setEditingBlock(null);
    setModalOpen(true);
  }
  function openEdit(block: ProgressBlock) {
    setEditingBlock(block);
    setModalOpen(true);
  }
  function handleSaved() {
    setModalOpen(false);
    setEditingBlock(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const supabase = createClient();
    const { error } = await supabase.from("level_progress").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) setError(error.message);
    router.refresh();
  }

  async function handleDrop(targetId: string) {
    const srcId = dragIdRef.current;
    dragIdRef.current = null;
    setDragOverId(null);
    if (!srcId || srcId === targetId) return;

    const current = [...orderedBlocks];
    const fromIdx = current.findIndex((b) => b.id === srcId);
    const toIdx = current.findIndex((b) => b.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    setOrderedBlocks(current);

    const supabase = createClient();
    const { error } = await supabase.rpc("reorder_progress_blocks", {
      p_list_id: listId,
      p_ordered_ids: current.map((b) => b.id),
    });
    if (error) setError(error.message);
    router.refresh();
  }

  const canPost = currentUserId !== null && !readOnly;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
        {canPost && (
          <button className="btn btn-primary" onClick={openAdd}>
            + Add Progress
          </button>
        )}
      </div>

      <div className={`msg ${error ? "error" : ""}`}>{error}</div>

      {orderedBlocks.length === 0 ? (
        <div className="empty-note">No progress blocks yet. Be the first to post what you&apos;re working on.</div>
      ) : (
        <div className="progress-grid">
          {orderedBlocks.map((block) => (
            <ProgressCard
              key={block.id}
              block={block}
              cardProps={
                canReorder
                  ? {
                      draggable: true,
                      className: dragOverId === block.id ? "drag-over" : "",
                      onDragStart: () => {
                        dragIdRef.current = block.id;
                      },
                      onDragEnd: () => setDragOverId(null),
                      onDragOver: (e) => {
                        e.preventDefault();
                        setDragOverId(block.id);
                      },
                      onDragLeave: () => setDragOverId((id) => (id === block.id ? null : id)),
                      onDrop: (e) => {
                        e.preventDefault();
                        handleDrop(block.id);
                      },
                    }
                  : undefined
              }
              actions={
                canPost && block.userId === currentUserId ? (
                  <>
                    <div className="icon-btn" title="Edit" onClick={() => openEdit(block)}>
                      &#9998;
                    </div>
                    <div className="icon-btn btn-danger" title="Delete" onClick={() => setDeleteTarget(block)}>
                      &#10005;
                    </div>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <ProgressModal
          key={editingBlock?.id ?? "new"}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          listId={listId}
          levels={levels}
          editingBlock={editingBlock}
          nextPosition={orderedBlocks.length + 1}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Remove your progress block for "${deleteTarget?.levelName ?? "this level"}"? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
