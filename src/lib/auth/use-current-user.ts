import { useEffect, useState } from "react";
import { authEnabled, supabase } from "./client";

/** Normalized user shape used across the app. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

/** Dev fallback user — shown only when auth is disabled. */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

/**
 * Current user + loading state from Supabase session.
 *
 * Auth disabled → DEV_USER, never pending.
 * Auth enabled → real user from Supabase session; null while loading.
 */
export function useCurrentUserState(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    isPending: authEnabled,
  });

  useEffect(() => {
    if (!authEnabled) {
      setState({ user: DEV_USER, isPending: false });
      return;
    }

    let active = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        const u = session.user;
        setState({
          user: {
            id: u.id,
            displayName: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
            primaryEmail: u.email ?? null,
            profileImageUrl: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
            isDevFallback: false,
          },
          isPending: false,
        });
      } else {
        setState({ user: null, isPending: false });
      }
    });

    // Listen for session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        if (session?.user) {
          const u = session.user;
          setState({
            user: {
              id: u.id,
              displayName: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
              primaryEmail: u.email ?? null,
              profileImageUrl: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
              isDevFallback: false,
            },
            isPending: false,
          });
        } else {
          setState({ user: null, isPending: false });
        }
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** Convenience: just the user (null = loading OR signed out). */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
