import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SecurityForm from "./security-form";

export default async function AccountSecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?mode=login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href="/profile">
          &larr; back to profile
        </Link>
        <h2 style={{ margin: "14px 0 18px" }}>Account Security</h2>
        <SecurityForm username={profile?.username ?? ""} />
      </div>
    </div>
  );
}
