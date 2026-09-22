/**
 * useContextRealtime — mounts the Context realtime bridge for the session.
 *
 * Mount once next to useSyncOnLogin (src/routes/__root.tsx). No-op when auth
 * is disabled or on the server. Incoming postgres_changes events are applied
 * straight into the Context store (LWW + immutable-evidence guards inside),
 * so another device's create/update/delete shows up within milliseconds
 * without any reload.
 */
import { useEffect } from "react";
import { authEnabled, supabase } from "@/lib/auth/client";
import { bindRealtimeChannel, unbindRealtimeChannel } from "./realtime";

export function useContextRealtime(): void {
  useEffect(() => {
    if (!authEnabled) return;

    let active = true;
    let currentUserId: string | null = null;

    const bind = (userId: string | null) => {
      if (!active) return;
      if (userId) {
        bindRealtimeChannel(userId);
      } else {
        unbindRealtimeChannel();
      }
      currentUserId = userId;
    };

    // Cover the reload-on-an-already-signed-in-session case (INITIAL_SESSION
    // may not fire again if the listener attaches after the event).
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => bind(session?.user?.id ?? null))
      .catch(() => undefined);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (userId !== currentUserId) bind(userId);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      unbindRealtimeChannel();
    };
  }, []);
}
