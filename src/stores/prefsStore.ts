import { create } from 'zustand';
import type { PreferenceProfile } from '@/types';
import { loadPrefs, savePrefs } from '@/lib/prefs/storage';
import { useVaultStore } from '@/stores/vaultStore';

interface PrefsStore {
  profile: PreferenceProfile;
  setProfile: (p: PreferenceProfile) => void;
  updateProfile: (fn: (p: PreferenceProfile) => PreferenceProfile) => void;
}

export const usePrefsStore = create<PrefsStore>((set) => ({
  profile: loadPrefs(),
  setProfile: (profile) => {
    savePrefs(profile);
    set({ profile });
    useVaultStore.getState().refreshClassStates();
  },
  updateProfile: (fn) => {
    set((s) => {
      const profile = fn(s.profile);
      savePrefs(profile);
      useVaultStore.getState().refreshClassStates();
      return { profile };
    });
  },
}));
