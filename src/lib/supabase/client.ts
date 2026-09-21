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
  if (typeof window !== "undefined") {
    client ??= createClient();
    return client;
  }
  // Server-side (SSR): auth pages don't SSR, so nothing should touch this —
  // but a module import must never pay for client construction either. Return
  // a lazy throwaway that only builds when a property is actually accessed,
  // so a missing/invalid env can fail one call instead of every route whose
  // import graph reaches this module.
  let instance: ReturnType<typeof createClient> | null = null;
  return new Proxy<ReturnType<typeof createClient>>({} as ReturnType<typeof createClient>, {
    get(_target, prop, receiver) {
      instance ??= createClient();
      const value = Reflect.get(instance, prop, receiver);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}
