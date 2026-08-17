import { createClient } from "@supabase/supabase-js";

// A stateless, non-cookie-bound client — used server-side only for the
// one-off signInWithPassword call that mints a tester's session tokens
// (see enterTester in app/admin/actions.ts). Never used for anything else.
export function createAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
