import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Uses @supabase/ssr for cookie-based auth sessions.
 * Env vars are exposed via VITE_ prefix so they reach the browser.
 */
export function createClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars. " +
      "Make sure .grok/app-env.json has these keys with VITE_ prefix.",
    );
  }
  return createBrowserClient(url, key);
}

/** Singleton for browser usage. */
let client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (typeof window === "undefined") {
    // Server-side during SSR: return a throwaway client (auth pages won't SSR)
    // or null — the real client mounts in the browser.
    return createClient();
  }
  client ??= createClient();
  return client;
}
