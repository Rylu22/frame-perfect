"use client";

import { useMemo, useState } from "react";
import { deleteAccounts, startViewAs } from "./actions";
import ConfirmDialog from "@/components/confirm-dialog";

export type AccountRow = {
  id: string;
  username: string;
  is_admin: boolean;
  is_test: boolean;
  created_at: string;
};

export default function AccountsManager({
  accounts,
  currentUserId,
}: {
  accounts: AccountRow[];
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? accounts.filter((a) => a.username.toLowerCase().includes(term)) : accounts;
  }, [accounts, search]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function confirmDelete() {
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteAccounts([...selected]);
      setSelected(new Set());
    } catch {
      setError("Something went wrong deleting those accounts.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <input
        type="text"
        placeholder="Search accounts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: "18px" }}
      />

      <div style={{ marginTop: "12px" }}>
        {filtered.length === 0 ? (
          <div className="empty-note">No matching accounts.</div>
        ) : (
          filtered.map((a) => (
            <div className="acct-row" key={a.id}>
              <input
                type="checkbox"
                checked={selected.has(a.id)}
                disabled={a.id === currentUserId}
                onChange={() => toggle(a.id)}
              />
              <span className="acct-name">
                {a.username}
                {a.is_admin && (
                  <span className="tier-tag" style={{ marginLeft: "8px", "--tier": "#8a3ffc" } as React.CSSProperties}>
                    Admin
                  </span>
                )}
              </span>
              {a.id !== currentUserId && (
                <form action={startViewAs.bind(null, a.id)}>
                  <button className="btn btn-ghost btn-sm" type="submit">
                    View As
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      <button
        className="btn btn-danger"
        style={{ marginTop: "10px" }}
        disabled={selected.size === 0 || deleting}
        onClick={() => setConfirmOpen(true)}
      >
        {deleting ? "Deleting..." : "Delete Selected"}
      </button>
      {error && <div className="msg error">{error}</div>}

      <ConfirmDialog
        open={confirmOpen}
        message={`Delete ${selected.size} account${selected.size === 1 ? "" : "s"} permanently? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
