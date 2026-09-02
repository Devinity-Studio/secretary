import { create } from 'zustand';
import type { UserProfile } from '@/types';
import { createId } from '@/lib/id';
import { getSetting, setSetting } from '@/lib/database';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isReady: boolean;
  init: () => Promise<void>;
  continueAsGuest: (displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const GUEST_KEY = 'guest_user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isReady: false,

  init: async () => {
    set({ isLoading: true });
    try {
      const raw = await getSetting(GUEST_KEY);
      if (raw) {
        const user = JSON.parse(raw) as UserProfile;
        set({ user, isReady: true, isLoading: false });
        return;
      }
      set({ user: null, isReady: true, isLoading: false });
    } catch {
      set({ user: null, isReady: true, isLoading: false });
    }
  },

  continueAsGuest: async (displayName = 'ผู้ใช้ทั่วไป') => {
    const user: UserProfile = {
      id: createId(),
      displayName,
      email: null,
      isGuest: true,
    };
    await setSetting(GUEST_KEY, JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    await setSetting(GUEST_KEY, '');
    set({ user: null });
  },
}));
