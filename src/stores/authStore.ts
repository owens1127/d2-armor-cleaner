import { create } from 'zustand';
import type { BungieMembership } from '@/types';

interface AuthState {
  membership: BungieMembership | null;
  setMembership: (m: BungieMembership | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  membership: null,
  setMembership: (membership) => set({ membership }),
}));
