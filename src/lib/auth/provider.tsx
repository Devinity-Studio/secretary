import type { ReactNode } from "react";

/**
 * App-wide auth provider mounted in __root.tsx.
 *
 * Supabase auth uses onAuthStateChange internally (in useCurrentUserState),
 * so no context provider is needed. This is kept as a stable mount point
 * for any future providers.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
