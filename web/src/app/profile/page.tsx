import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileListRows } from "./data";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?mode=login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const rows = await getProfileListRows(supabase, user.id);

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href="/dashboard">
          &larr; back to dashboard
        </Link>

        <div className="topbar" style={{ marginTop: "14px" }}>
          <h2 style={{ margin: 0 }}>{profile?.username ?? "My Profile"}</h2>
          <Link className="btn btn-ghost btn-sm" href="/profile/security">
            Account Security
          </Link>
        </div>

        <div className="section-title" style={{ marginTop: "20px" }}>
          Lists You&apos;ve Participated In
        </div>
        {rows.length === 0 ? (
          <div className="empty-note">
            No victories or verifications yet — beat a level or get one verified to show up here.
          </div>
        ) : (
          rows.map((row) => (
            <Link className="points-row" key={row.listId} href={`/lists/${row.listId}/stats/${profile?.username}`}>
              <span className="pname">{row.listName}</span>
              <span className="pval">
                #{row.rank} &middot; {row.points.toFixed(2)} pts
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
