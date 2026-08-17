import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const VIEW_AS_COOKIE = "fp-view-as";

export type ViewAsContext = {
  user: User | null;
  isAdmin: boolean;
  viewAsUserId: string | null;
  viewAsUsername: string | null;
  effectiveUserId: string | null;
};

// Admins can browse the app as if they were another user, purely for
// reading — this never changes whose session is actually authenticated,
// so every write RLS policy (all keyed on auth.uid()) stays scoped to the
// real admin, who almost never owns the thing being viewed. That's what
// makes this "no write access at all" by construction, not just hidden UI.
export async function getViewAsContext(): Promise<ViewAsContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false, viewAsUserId: null, viewAsUsername: null, effectiveUserId: null };
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  const isAdmin = profile?.is_admin ?? false;

  const cookieStore = await cookies();
  const viewAsUserId = isAdmin ? (cookieStore.get(VIEW_AS_COOKIE)?.value ?? null) : null;

  let viewAsUsername: string | null = null;
  if (viewAsUserId) {
    const { data: viewedProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", viewAsUserId)
      .single();
    viewAsUsername = viewedProfile?.username ?? null;
  }

  return {
    user,
    isAdmin,
    viewAsUserId,
    viewAsUsername,
    effectiveUserId: viewAsUserId ?? user.id,
  };
}
