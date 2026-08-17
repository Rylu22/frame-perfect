"use client";

import { useState } from "react";
import { renameSelf, changePassword } from "./actions";

export default function SecurityForm({ username: initialUsername }: { username: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [usernameMsg, setUsernameMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revealPassword, setRevealPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveUsername() {
    setUsernameMsg(null);
    setSavingUsername(true);
    try {
      await renameSelf(usernameInput);
      setUsername(usernameInput.trim());
      setEditingUsername(false);
    } catch (e) {
      setUsernameMsg({ text: e instanceof Error ? e.message : "Couldn't rename your account.", error: true });
    } finally {
      setSavingUsername(false);
    }
  }

  async function savePassword() {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Passwords don't match.", error: true });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
      setPasswordMsg({ text: "Password updated.", error: false });
      setNewPassword("");
      setConfirmPassword("");
      setEditingPassword(false);
    } catch (e) {
      setPasswordMsg({ text: e instanceof Error ? e.message : "Couldn't update your password.", error: true });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="card-panel">
      <div className="editor-row">
        {editingUsername ? (
          <>
            <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} />
            <button className="btn btn-ghost btn-sm" onClick={saveUsername} disabled={savingUsername}>
              {savingUsername ? "Saving..." : "Save"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditingUsername(false);
                setUsernameInput(username);
                setUsernameMsg(null);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1 }}>
              <label style={{ marginBottom: "2px" }}>Username</label>
              <div style={{ fontWeight: 700 }}>{username}</div>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingUsername(true)}>
              Edit
            </button>
          </>
        )}
      </div>
      {usernameMsg && <div className={`msg ${usernameMsg.error ? "error" : "ok"}`}>{usernameMsg.text}</div>}

      <div className="editor-row" style={{ marginTop: "10px" }}>
        <span style={{ flex: 1 }}>
          <label style={{ marginBottom: "2px" }}>Password</label>
          <div style={{ fontWeight: 700, letterSpacing: "2px" }}>&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</div>
        </span>
        {!editingPassword && (
          <button className="btn btn-ghost btn-sm" onClick={() => setEditingPassword(true)}>
            Edit
          </button>
        )}
      </div>

      {editingPassword && (
        <div style={{ marginTop: "10px" }}>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type={revealPassword ? "text" : "password"}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <div
                className="icon-btn"
                title="Hold to reveal"
                onMouseDown={() => setRevealPassword(true)}
                onMouseUp={() => setRevealPassword(false)}
                onMouseLeave={() => setRevealPassword(false)}
                onTouchStart={() => setRevealPassword(true)}
                onTouchEnd={() => setRevealPassword(false)}
              >
                &#128065;
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              type={revealPassword ? "text" : "password"}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-primary" onClick={savePassword} disabled={savingPassword}>
              {savingPassword ? "Saving..." : "Save Password"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setEditingPassword(false);
                setNewPassword("");
                setConfirmPassword("");
                setPasswordMsg(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {passwordMsg && <div className={`msg ${passwordMsg.error ? "error" : "ok"}`}>{passwordMsg.text}</div>}
    </div>
  );
}
