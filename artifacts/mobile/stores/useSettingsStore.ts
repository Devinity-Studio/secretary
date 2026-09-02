import { create } from 'zustand';
import { getSetting, setSetting } from '@/lib/database';

type Density = 'compact' | 'normal' | 'comfortable';

interface SettingsState {
  language: 'th' | 'en';
  density: Density;
  weekendDays: number[]; // 0=Sun ... 6=Sat
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (lang: 'th' | 'en') => Promise<void>;
  setDensity: (d: Density) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'th',
  density: 'normal',
  weekendDays: [0, 6],
  isHydrated: false,

  hydrate: async () => {
    const language = ((await getSetting('language')) as 'th' | 'en') || 'th';
    const density = ((await getSetting('density')) as Density) || 'normal';
    const weekendRaw = await getSetting('weekend_days');
    const weekendDays = weekendRaw ? (JSON.parse(weekendRaw) as number[]) : [0, 6];
    set({ language, density, weekendDays, isHydrated: true });
  },

  setLanguage: async (language) => {
    await setSetting('language', language);
    set({ language });
  },

  setDensity: async (density) => {
    await setSetting('density', density);
    set({ density });
  },
}));
