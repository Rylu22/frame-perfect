"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_REGEX, usernameToEmail } from "@/lib/auth";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

export type AuthState = { error: string | null };

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!USERNAME_REGEX.test(username)) {
    return {
      error:
        "Username must be 3-20 characters: letters, numbers, underscores only.",
    };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username } },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("duplicate")) {
      return { error: "That username is already taken." };
    }
    return { error: error.message };
  }
  if (!data.session) {
    return {
      error:
        "Account created, but no session was returned. Ask the project owner to disable email confirmation in Supabase Auth settings (usernames use a placeholder email with no real inbox).",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    return { error: "Enter a username and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    return { error: "Incorrect username or password." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}
