import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewAsContext } from "@/lib/view-as";
import { canEditList } from "@/lib/list-access";
import SubmitRecordForm from "./submit-record-form";

export default async function SubmitRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, viewAsUserId } = await getViewAsContext();

  if (!user) {
    redirect(`/auth?mode=login`);
  }

  const { data: list } = await supabase.from("lists").select("id, name, rules, owner_id").eq("id", id).single();
  if (!list) notFound();
  // Owners and editors can't submit to a list they moderate, and an admin
  // currently viewing as someone else is read-only everywhere — including
  // here, even though the write itself would technically go through as
  // the admin's real account, not the account being viewed.
  if (viewAsUserId || (await canEditList(supabase, id, user.id))) {
    redirect(`/lists/${id}`);
  }

  const { data: levelRows } = await supabase
    .from("levels")
    .select("id, name, position, verifier_id")
    .eq("list_id", id)
    .order("position");

  // A level's own verifier already gets credit for it — don't offer it as
  // a level they could also submit a victor record for (the DB enforces
  // this too, but filtering it out here avoids a confusing round-trip).
  const levels = (levelRows ?? []).filter((lv) => lv.verifier_id !== user.id);

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={`/lists/${id}`}>
          &larr; back to list
        </Link>
        <h2 style={{ margin: "14px 0 6px" }}>Submit a Record — {list.name}</h2>
        {list.rules && <div className="rule-box">{list.rules}</div>}
        <div className="card-panel">
          <SubmitRecordForm listId={id} levels={levels ?? []} />
        </div>
      </div>
    </div>
  );
}
