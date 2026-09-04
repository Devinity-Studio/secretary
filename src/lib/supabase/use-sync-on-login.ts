/**
 * useSyncOnLogin — hydrates Zustand stores from Supabase after login.
 *
 * Flow:
 *   1. Auth state changes → logged in
 *   2. pullAll() fetches remote data
 *   3. If remote is empty but local has data → pushAllLocal() (first login)
 *   4. If remote has data → replaceAll() on each store (hydrate from cloud)
 *   5. localStorage remains the read path (instant, offline-safe)
 */
import { useEffect, useRef } from "react";
import { authEnabled, supabase } from "@/lib/auth/client";
import { pullAll, pushAllLocal } from "@/lib/supabase/sync";
import { useFinanceStore } from "@/lib/finance/store";
import { useGoalStore } from "@/lib/goals/store";
import { useCalendarStore } from "@/lib/calendar/store";

export function useSyncOnLogin() {
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!authEnabled) return;

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

        const localHasData =
          localAccounts.length > 0 ||
          localTransactions.length > 0 ||
          localGoals.length > 0 ||
          localContributions.length > 0 ||
          localEvents.length > 0;

        const remoteHasData =
          remote.accounts.length > 0 ||
          remote.transactions.length > 0 ||
          remote.goals.length > 0 ||
          remote.contributions.length > 0 ||
          remote.events.length > 0;

        if (remoteHasData) {
          // Remote has data → hydrate local stores
          useFinanceStore.getState().replaceAll(remote.accounts, remote.transactions);
          useGoalStore.getState().replaceAll(remote.goals, remote.contributions);
          useCalendarStore.getState().replaceAll(remote.events);
        } else if (localHasData) {
          // First login with existing local data → push to cloud
          await pushAllLocal({
            accounts: localAccounts,
            transactions: localTransactions,
            goals: localGoals,
            contributions: localContributions,
            events: localEvents,
          });
        }
        // If both empty → nothing to do
      } catch (err) {
        console.error("[sync] pull failed:", err);
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
