import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/app/auth/actions";
import AccountsManager from "./accounts-manager";
import TestingPanel from "./testing-panel";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "testing" ? "testing" : "accounts";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login");

  const { data: profile } = await supabase.from("profiles").select("username, is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: accounts } = await supabase
    .from("profiles")
    .select("id, username, is_admin, is_test, created_at")
    .order("created_at", { ascending: false });

  const testers = (accounts ?? []).filter((a) => a.is_test).map((a) => ({ id: a.id, username: a.username }));

  return (
    <div className="page">
      <div className="wrap">
        <div className="topbar">
          <div className="who">
            Admin console — <b>{profile.username}</b>
          </div>
          <form action={logOut}>
            <button className="btn btn-ghost btn-sm" type="submit">
              Log Out
            </button>
          </form>
        </div>

        <div className="auth-tabs" style={{ marginTop: "20px" }}>
          <Link href="/admin" className={`auth-tab ${activeTab === "accounts" ? "active" : ""}`}>
            Manage Accounts
          </Link>
          <Link href="/admin?tab=testing" className={`auth-tab ${activeTab === "testing" ? "active" : ""}`}>
            Testing
          </Link>
        </div>

        {activeTab === "accounts" ? (
          <>
            <h2 style={{ marginTop: "20px" }}>Manage Accounts</h2>
            <AccountsManager accounts={(accounts ?? []).filter((a) => !a.is_test)} currentUserId={user.id} />
          </>
        ) : (
          <TestingPanel testers={testers} />
        )}
      </div>
    </div>
  );
}
