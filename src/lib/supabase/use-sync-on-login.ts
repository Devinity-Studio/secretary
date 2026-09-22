/**
 * useSyncOnLogin — hydrates Zustand stores from Supabase after login.
 *
 * Flow:
 *   1. Auth state changes → logged in
 *   2. pullAll() fetches remote data
 *   3. If remote is empty but local has data → pushAllLocal() (first login)
 *   4. If remote has data → merge (last-write-wins) into local stores
 *   5. Local winners are pushed back so every device converges
 *   6. localStorage remains the read path (instant, offline-safe)
 */
import { useEffect, useRef } from "react";
import { authEnabled, supabase } from "@/lib/auth/client";
import { pullAll, pushAllLocal, mergeContexts } from "@/lib/supabase/sync";
import { initOutboxListeners, scheduleOutboxFlush } from "@/lib/supabase/outbox";
import { notifyPullFailure } from "@/lib/supabase/sync-status";
import { useFinanceStore } from "@/lib/finance/store";
import { useGoalStore } from "@/lib/goals/store";
import { useCalendarStore } from "@/lib/calendar/store";
import { useContextStore } from "@/lib/context/store";

export function useSyncOnLogin() {
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!authEnabled) return;

    // Automatic outbox flush triggers: back online / tab visible / session
    // available. Queued offline pushes replay here and after each login sync.
    initOutboxListeners();

    let active = true;

    async function sync(userId: string) {
      if (hasSynced.current) return;
      hasSynced.current = true;

      try {
        const remote = await pullAll();
        if (!active || !remote) return;

        const localAccounts = useFinanceStore.getState().accounts;
        const localTransactions = useFinanceStore.getState().transactions;
        const localGoals = useGoalStore.getState().goals;
        const localContributions = useGoalStore.getState().contributions;
        const localEvents = useCalendarStore.getState().events;
        const contextStore = useContextStore.getState();
        const localContexts = Object.values(contextStore.contexts);
        const localEvidence = Object.values(contextStore.evidence);

        const localHasData =
          localAccounts.length > 0 ||
          localTransactions.length > 0 ||
          localGoals.length > 0 ||
          localContributions.length > 0 ||
          localEvents.length > 0 ||
          localContexts.length > 0;

        const remoteHasData =
          remote.accounts.length > 0 ||
          remote.transactions.length > 0 ||
          remote.goals.length > 0 ||
          remote.contributions.length > 0 ||
          remote.events.length > 0 ||
          remote.contexts.length > 0 ||
          remote.contextEvidence.length > 0;

        if (remoteHasData) {
          // Remote has data → merge into local stores.
          useFinanceStore.getState().replaceAll(remote.accounts, remote.transactions);
          useGoalStore.getState().replaceAll(remote.goals, remote.contributions);
          useCalendarStore.getState().replaceAll(remote.events);

          // Context merge is last-write-wins on updatedAt so offline edits
          // from this device survive; winners that are local get pushed back.
          const merged = mergeContexts(
            { contexts: contextStore.contexts, evidence: contextStore.evidence },
            remote.contexts,
            remote.contextEvidence,
          );
          contextStore.replaceAllFromSync(
            Object.values(merged.contexts),
            Object.values(merged.evidence),
            contextStore.patternOnlyContextIds,
          );
          // Push back local LWW winners + brand-new local rows (fire-and-forget).
          const evidenceToPush = new Map<string, (typeof merged.evidence)[string]>();
          for (const c of merged.toPush) {
            for (const eid of c.evidenceIds) {
              const ev = merged.evidence[eid];
              if (ev) evidenceToPush.set(eid, ev);
            }
          }
          if (merged.toPush.length > 0) {
            pushAllLocal({
              accounts: [],
              transactions: [],
              goals: [],
              contributions: [],
              events: [],
              contexts: merged.toPush,
              contextEvidence: [...evidenceToPush.values()],
            }).catch((err) => console.error("[sync] context push-back failed:", err));
          }
        } else if (localHasData) {
          // First login with existing local data → push to cloud
          await pushAllLocal({
            accounts: localAccounts,
            transactions: localTransactions,
            goals: localGoals,
            contributions: localContributions,
            events: localEvents,
            contexts: localContexts,
            contextEvidence: localEvidence,
          });
        }
        // If both empty → nothing to do
        // Login sync finished under a valid session → give the outbox its
        // window now (covers pushes queued while the user was logged out).
        void scheduleOutboxFlush(0);
      } catch (err) {
        console.error("[sync] pull failed:", err);
        notifyPullFailure(err instanceof Error ? err.message : String(err));
      }
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session?.user) {
        sync(session.user.id);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active && session?.user) {
          hasSynced.current = false; // allow re-sync on new login
          sync(session.user.id);
        }
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
}
