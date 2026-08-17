"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import { VIEW_AS_COOKIE } from "@/lib/view-as";
import { USERNAME_REGEX, usernameToEmail } from "@/lib/auth";

const ADMIN_RETURN_COOKIE = "fp-admin-return";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  return user;
}

export async function deleteAccounts(userIds: string[]) {
  const admin = await requireAdmin();
  const ids = userIds.filter((id) => id !== admin.id); // never delete yourself in a batch
  if (ids.length === 0) return;

  const adminClient = createAdminClient();
  for (const id of ids) {
    await adminClient.auth.admin.deleteUser(id);
  }
  revalidatePath("/admin");
}

export async function startViewAs(targetUserId: string) {
  await requireAdmin();
  const cookieStore = await cookies();
  cookieStore.set(VIEW_AS_COOKIE, targetUserId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

export async function stopViewAs() {
  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
  redirect("/dashboard");
}

export async function createTester() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: existing } = await supabase.from("profiles").select("username").eq("is_test", true);
  const numbers = (existing ?? [])
    .map((p) => /^Tester(\d+)$/.exec(p.username)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  const username = `Tester${numbers.length ? Math.max(...numbers) + 1 : 1}`;

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.createUser({
    email: usernameToEmail(username),
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { username, is_test: true },
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function renameTester(userId: string, newUsername: string) {
  await requireAdmin();
  const trimmed = newUsername.trim();
  if (!USERNAME_REGEX.test(trimmed)) {
    throw new Error("Username must be 3-20 characters: letters, numbers, underscores only.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ username: trimmed }).eq("id", userId);
  if (error) throw new Error(error.message.includes("duplicate") ? "That username is already taken." : error.message);

  revalidatePath("/admin");
}

// Full read/write access as the tester — a real session swap, unlike
// View As. Only ever targets synthetic, admin-created accounts (checked
// below), never a real user. The admin's own session is stashed in a
// cookie first so exitTesting can restore it.
export async function enterTester(testerId: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { data: targetProfile } = await supabase.from("profiles").select("is_test").eq("id", testerId).single();
  if (!targetProfile?.is_test) {
    throw new Error("Only testing sandbox accounts can be entered directly.");
  }

  const adminClient = createAdminClient();
  const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(testerId);
  if (getUserError || !targetUser.user?.email) {
    throw new Error("Could not look up that tester account.");
  }

  const freshPassword = randomUUID();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(testerId, { password: freshPassword });
  if (updateError) throw new Error(updateError.message);

  const anonClient = createAnonClient();
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: targetUser.user.email,
    password: freshPassword,
  });
  if (signInError || !signInData.session) {
    throw new Error("Could not start a tester session.");
  }

  const {
    data: { session: adminSession },
  } = await supabase.auth.getSession();

  const cookieStore = await cookies();
  if (adminSession) {
    cookieStore.set(
      ADMIN_RETURN_COOKIE,
      JSON.stringify({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token }),
      { httpOnly: true, sameSite: "lax", path: "/" },
    );
  }

  await supabase.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });

  redirect("/dashboard");
}

export async function exitTesting() {
  const cookieStore = await cookies();
  const stashed = cookieStore.get(ADMIN_RETURN_COOKIE)?.value;

  if (stashed) {
    try {
      const { access_token, refresh_token } = JSON.parse(stashed);
      const supabase = await createClient();
      await supabase.auth.setSession({ access_token, refresh_token });
    } catch {
      // Nothing to restore — fall through and just clear the stash below.
    }
    cookieStore.delete(ADMIN_RETURN_COOKIE);
  }

  redirect("/dashboard");
}
