"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateListState = { error: string | null };

export async function createList(
  _prevState: CreateListState,
  formData: FormData,
): Promise<CreateListState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=login");
  }

  const name = String(formData.get("name") || "").trim();
  const targetSize = parseInt(String(formData.get("targetSize") || ""), 10);
  const rules = String(formData.get("rules") || "").trim();

  if (!name) {
    return { error: "Give your list a name." };
  }
  if (!Number.isFinite(targetSize) || targetSize < 1) {
    return { error: "Choose at least 1 level." };
  }

  const { data, error } = await supabase
    .from("lists")
    .insert({ name, owner_id: user.id, target_size: targetSize, rules })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Couldn't create the list. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/lists/${data.id}`);
}
