import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Uses @supabase/ssr for cookie-based auth sessions.
 * Env vars are exposed via VITE_ prefix so they reach the browser.
 */
export function createClient() {
  return createBrowserClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!,
  );
}

/** Singleton for browser usage. */
let client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (typeof window === "undefined") {
    // Server-side: create fresh each time (no shared state)
    return createClient();
  }
  client ??= createClient();
  return client;
}
