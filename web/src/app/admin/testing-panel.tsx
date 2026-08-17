"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { createTester, renameTester, deleteAccounts, enterTester } from "./actions";

export type TesterRow = { id: string; username: string };

export default function TestingPanel({ testers }: { testers: TesterRow[] }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TesterRow | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      await createTester();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create a tester account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string) {
    setError(null);
    try {
      await renameTester(id, editValue);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rename that account.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAccounts([deleteTarget.id]);
    } catch {
      setError("Couldn't delete that account.");
    }
    setDeleteTarget(null);
  }

  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: "13px", margin: "18px 0" }}>
        Passwordless testing accounts, fully sandboxed from real users and lists.
      </div>
      <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
        {creating ? "Creating..." : "+ New Tester"}
      </button>
      <div className={`msg ${error ? "error" : ""}`}>{error}</div>

      <div style={{ marginTop: "14px" }}>
        {testers.length === 0 ? (
          <div className="empty-note">No testers yet.</div>
        ) : (
          testers.map((t) => (
            <div className="tester-row" key={t.id}>
              {editingId === t.id ? (
                <>
                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRename(t.id)}>
                    Save
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 700 }}>{t.username}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingId(t.id);
                      setEditValue(t.username);
                    }}
                  >
                    Rename
                  </button>
                  <form action={enterTester.bind(null, t.id)}>
                    <button className="btn btn-primary btn-sm" type="submit">
                      Enter
                    </button>
                  </form>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(t)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        message={`Delete tester "${deleteTarget?.username ?? ""}" permanently?`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
