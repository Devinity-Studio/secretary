import { getSupabase } from "@/lib/supabase/client";

/**
 * Supabase Auth client (browser-side).
 * Replaces the old Better Auth client.
 *
 * Auth is enabled when VITE_AUTH_ENABLED !== "false".
 * Sign-in uses Google OAuth via Supabase.
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The Supabase client for browser-side auth operations. */
export const supabase = getSupabase();

/**
 * Start Google sign-in via Supabase.
 * Redirects to Supabase hosted login page with Google provider.
 */
export async function signInWithGoogle(callbackURL = "/"): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${callbackURL}`,
    },
  });
  if (error) throw error;
}

/**
 * Sign out of Supabase.
 * Clears the session and redirects to the given path.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Sign out error:", error);
  if (typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}

/**
 * Get the current session (browser-side).
 * Returns null if not signed in.
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
