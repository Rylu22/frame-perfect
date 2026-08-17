"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { USERNAME_REGEX, usernameToEmail } from "@/lib/auth";

// Username doubles as the (invisible) login email's local part, so
// renaming has to update both profiles.username and the Auth email in
// the same call — otherwise a future login attempt with the new username
// reconstructs an email that no longer matches the account. The email
// update goes through the admin client rather than the user's own
// session: Supabase's default self-service email change requires
// confirming via links sent to both the old and new addresses, and these
// synthetic addresses have no real inbox to receive them — the change
// would silently never take effect. The admin API applies it immediately.
// This still only ever acts on the caller's own account, verified by
// their session at the top of this function.
export async function renameSelf(newUsername: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login");

  const trimmed = newUsername.trim();
  if (!USERNAME_REGEX.test(trimmed)) {
    throw new Error("Username must be 3-20 characters: letters, numbers, underscores only.");
  }

  const { data: currentProfile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const oldUsername = currentProfile?.username;
  if (oldUsername === trimmed) return;

  const { error: profileError } = await supabase.from("profiles").update({ username: trimmed }).eq("id", user.id);
  if (profileError) {
    throw new Error(
      profileError.message.toLowerCase().includes("duplicate") ? "That username is already taken." : profileError.message,
    );
  }

  const adminClient = createAdminClient();
  const { error: emailError } = await adminClient.auth.admin.updateUserById(user.id, {
    email: usernameToEmail(trimmed),
    email_confirm: true,
  });
  if (emailError) {
    if (oldUsername) {
      await supabase.from("profiles").update({ username: oldUsername }).eq("id", user.id);
    }
    throw new Error("Couldn't update your login email to match. Try again.");
  }

  revalidatePath("/profile");
  revalidatePath("/profile/security");
  revalidatePath("/dashboard");
}

export async function changePassword(newPassword: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?mode=login");

  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
