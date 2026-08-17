"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/confirm-dialog";

export type EditorRow = { userId: string; username: string };

export default function SettingsForm({
  listId,
  name: initialName,
  targetSize: initialTargetSize,
  rules: initialRules,
  levelCount,
  editors: initialEditors,
  isOwner,
}: {
  listId: string;
  name: string;
  targetSize: number;
  rules: string;
  levelCount: number;
  editors: EditorRow[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [targetSize, setTargetSize] = useState(initialTargetSize);
  const [rules, setRules] = useState(initialRules);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [editors, setEditors] = useState(initialEditors);
  const [editorUsername, setEditorUsername] = useState("");
  const [editorMsg, setEditorMsg] = useState<{ text: string; error: boolean } | null>(null);

  async function save() {
    setMsg(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMsg({ text: "Give your list a name.", error: true });
      return;
    }
    if (!targetSize || targetSize < 1) {
      setMsg({ text: "Choose at least 1 level.", error: true });
      return;
    }
    if (targetSize < levelCount) {
      setMsg({
        text: `Target size can't be smaller than the ${levelCount} levels already on this list.`,
        error: true,
      });
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("lists")
      .update({ name: trimmedName, target_size: targetSize, rules: rules.trim() })
      .eq("id", listId);
    setSaving(false);

    if (error) {
      setMsg({ text: error.message, error: true });
      return;
    }
    setMsg({ text: "Settings saved.", error: false });
    router.refresh();
  }

  async function addEditor() {
    setEditorMsg(null);
    const trimmed = editorUsername.trim();
    if (!trimmed) return;

    const supabase = createClient();
    const { data: match } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", trimmed)
      .maybeSingle();

    if (!match) {
      setEditorMsg({ text: `"${trimmed}" isn't a registered account.`, error: true });
      return;
    }
    if (editors.some((e) => e.userId === match.id)) {
      setEditorMsg({ text: "Already an editor.", error: true });
      return;
    }

    const { error } = await supabase.from("list_editors").insert({ list_id: listId, user_id: match.id });
    if (error) {
      setEditorMsg({ text: error.message, error: true });
      return;
    }
    setEditors([...editors, { userId: match.id, username: match.username }]);
    setEditorUsername("");
  }

  async function removeEditor(userId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("list_editors").delete().eq("list_id", listId).eq("user_id", userId);
    if (!error) setEditors(editors.filter((e) => e.userId !== userId));
  }

  async function deleteList() {
    const supabase = createClient();
    await supabase.from("lists").delete().eq("id", listId);
    router.push("/dashboard");
  }

  return (
    <>
      <div className="card-panel">
        <div className="field">
          <label htmlFor="stName">List name</label>
          <input type="text" id="stName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="stSize">Target size</label>
          <input
            type="number"
            id="stSize"
            min={1}
            value={targetSize}
            onChange={(e) => setTargetSize(parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div className="field">
          <label htmlFor="stRules">
            Rules for record submissions{" "}
            <span style={{ textTransform: "none", letterSpacing: 0 }}>(shown to players)</span>
          </label>
          <textarea id="stRules" value={rules} onChange={(e) => setRules(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {msg && <div className={`msg ${msg.error ? "error" : "ok"}`}>{msg.text}</div>}
      </div>

      {isOwner && (
        <>
          <div className="section-title">Editors</div>
          <div className="card-panel">
            {editors.length === 0 ? (
              <div className="empty-note">No editors invited yet.</div>
            ) : (
              editors.map((e) => (
                <div key={e.userId} className="editor-row">
                  <span style={{ flex: 1, fontWeight: 700 }}>{e.username}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => removeEditor(e.userId)}>
                    Remove
                  </button>
                </div>
              ))
            )}
            <div className="field" style={{ marginTop: "14px" }}>
              <label htmlFor="editorUsername">Invite an editor (existing account)</label>
              <input
                type="text"
                id="editorUsername"
                value={editorUsername}
                onChange={(e) => setEditorUsername(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost btn-block" onClick={addEditor}>
              + Add Editor
            </button>
            {editorMsg && <div className={`msg ${editorMsg.error ? "error" : "ok"}`}>{editorMsg.text}</div>}
          </div>

          <div className="section-title">Danger Zone</div>
          <button className="btn btn-danger btn-block" onClick={() => setDeleteOpen(true)}>
            Delete List
          </button>

          <ConfirmDialog
            open={deleteOpen}
            message={`Delete "${name}" permanently? This can't be undone.`}
            onConfirm={deleteList}
            onCancel={() => setDeleteOpen(false)}
          />
        </>
      )}
    </>
  );
}
