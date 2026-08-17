import { createClient } from "@supabase/supabase-js";

// Server-only. Bypasses RLS entirely — never import this from a "use
// client" file, and only call it from Server Actions / Route Handlers
// that have already re-verified the caller is an admin.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
