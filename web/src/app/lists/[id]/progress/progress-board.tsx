"use client";

import { useState } from "react";
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
  permissionFrom: string;
  publisher: string;
  thumbnailUrl: string | null;
  note1: string;
  note2: string;
  note3: string;
};

export default function ProgressBoard({
  listId,
  levels,
  blocks,
  currentUserId,
  readOnly,
}: {
  listId: string;
  levels: { id: string; name: string; position: number }[];
  blocks: ProgressBlock[];
  currentUserId: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ProgressBlock | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgressBlock | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      {blocks.length === 0 ? (
        <div className="empty-note">No progress blocks yet. Be the first to post what you&apos;re working on.</div>
      ) : (
        blocks.map((block) => (
          <ProgressCard
            key={block.id}
            block={block}
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
        ))
      )}

      {modalOpen && (
        <ProgressModal
          key={editingBlock?.id ?? "new"}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          listId={listId}
          levels={levels}
          editingBlock={editingBlock}
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
