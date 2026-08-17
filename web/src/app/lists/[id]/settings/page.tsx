import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditList } from "@/lib/list-access";
import SettingsForm, { type EditorRow } from "./settings-form";

export default async function ListSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: list } = await supabase.from("lists").select("id, name, target_size, rules, owner_id").eq("id", id).single();
  if (!list) notFound();
  if (!(await canEditList(supabase, id, user?.id))) redirect(`/lists/${id}`);
  const isOwner = user?.id === list.owner_id;

  const { count: levelCount } = await supabase
    .from("levels")
    .select("id", { count: "exact", head: true })
    .eq("list_id", id);

  const { data: editorRows } = await supabase
    .from("list_editors")
    .select("user_id, profiles!user_id(username)")
    .eq("list_id", id)
    .returns<{ user_id: string; profiles: { username: string } | { username: string }[] | null }[]>();

  const editors: EditorRow[] = (editorRows ?? []).map((e) => {
    const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return { userId: e.user_id, username: profile?.username ?? "unknown" };
  });

  return (
    <div className="page">
      <div className="wrap-narrow">
        <Link className="back-link" href={`/lists/${id}`}>
          &larr; back to list
        </Link>
        <h2 style={{ margin: "14px 0 18px" }}>List Settings — {list.name}</h2>
        <SettingsForm
          listId={id}
          name={list.name}
          targetSize={list.target_size}
          rules={list.rules ?? ""}
          levelCount={levelCount ?? 0}
          editors={editors}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
