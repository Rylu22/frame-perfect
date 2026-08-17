import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateListForm from "./create-list-form";

export default async function CreateListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=login");
  }

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href="/dashboard">
          &larr; back to dashboard
        </Link>
        <h2 style={{ margin: "14px 0 18px" }}>Build a New List</h2>
        <div className="card-panel">
          <CreateListForm />
        </div>
      </div>
    </div>
  );
}
