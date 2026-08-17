import type { SupabaseClient } from "@supabase/supabase-js";

// Reuses the exact same check the RLS policies use (public.is_list_owner_or_editor),
// so "can this page let them in" can never drift from "will the database
// actually let them write" — the two failure modes (page.tsx redirect,
// RLS rejection) are backed by one source of truth.
export async function canEditList(
  supabase: SupabaseClient,
  listId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase.rpc("is_list_owner_or_editor", { p_list_id: listId, p_user_id: userId });
  return data === true;
}
