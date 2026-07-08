import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client. Anon key + RLS; used for auth flows and reads. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
