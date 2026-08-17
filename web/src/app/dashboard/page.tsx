import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/app/auth/actions";
import { getViewAsContext } from "@/lib/view-as";
import { stopViewAs, exitTesting } from "@/app/admin/actions";
import ListBrowser, { type DashboardListRow } from "./list-browser";

type ListQueryRow = {
  id: string;
  name: string;
  owner_id: string;
  target_size: number;
  profiles: { username: string } | { username: string }[] | null;
  levels: { count: number }[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { user, isAdmin, viewAsUserId, viewAsUsername, effectiveUserId } = await getViewAsContext();

  if (!user) {
    redirect("/auth?mode=login");
  }
  const currentUserId = effectiveUserId ?? user.id;

  const { data: profile } = await supabase.from("profiles").select("username, is_test").eq("id", user.id).single();

  const { data: listRows } = await supabase
    .from("lists")
    .select("id, name, owner_id, target_size, profiles!owner_id(username), levels(count)")
    .order("created_at", { ascending: false })
    .returns<ListQueryRow[]>();

  const lists: DashboardListRow[] = (listRows ?? []).map((row) => {
    const ownerProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      name: row.name,
      owner_id: row.owner_id,
      owner_username: ownerProfile?.username ?? "unknown",
      target_size: row.target_size,
      level_count: row.levels?.[0]?.count ?? 0,
    };
  });

  return (
    <div className="page">
      <div className="wrap">
        <div className="topbar">
          <div className="who">
            Signed in as <b>{profile?.username ?? user.email}</b>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Link className="btn btn-ghost btn-sm" href="/profile">
              My Profile
            </Link>
            {isAdmin && !viewAsUserId && (
              <Link className="btn btn-ghost btn-sm" href="/admin">
                Admin Console
              </Link>
            )}
            <form action={logOut}>
              <button className="btn btn-ghost btn-sm" type="submit">
                Log Out
              </button>
            </form>
          </div>
        </div>

        {viewAsUserId && (
          <div className="mode-banner viewonly">
            <span>
              &#128065; Viewing as <b>{viewAsUsername ?? "unknown"}</b> — read only
            </span>
            <form action={stopViewAs}>
              <button className="mb-exit" type="submit">
                Exit
              </button>
            </form>
          </div>
        )}

        {profile?.is_test && (
          <div className="mode-banner testing">
            <span>
              &#129514; Testing sandbox as <b>{profile.username}</b> — isolated from real data
            </span>
            <form action={exitTesting}>
              <button className="mb-exit" type="submit">
                Exit
              </button>
            </form>
          </div>
        )}

        <h2>Your Lists</h2>
        {!viewAsUserId && (
          <Link
            className="btn btn-primary"
            style={{ marginTop: "14px", display: "inline-block" }}
            href="/lists/new"
          >
            + Build a New List
          </Link>
        )}

        <ListBrowser lists={lists} currentUserId={currentUserId} />
      </div>
    </div>
  );
}
