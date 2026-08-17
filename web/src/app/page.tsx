import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="page page-center">
      <div className="home-hero">
        <div className="eyebrow">{"// list building for geometry dash"}</div>
        <h1>FRAME PERFECT</h1>
        <div className="sub">Geometry Dash List Building</div>
        <div className="home-actions">
          <Link className="btn btn-primary" href="/auth?mode=signup">
            Sign Up
          </Link>
          <Link className="btn btn-ghost" href="/auth?mode=login">
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
