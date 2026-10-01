import { create } from 'zustand';

interface PendingReplyState {
  typingCount: number;
  hasActiveJob: boolean;
}

interface PendingReplyActions {
  incrementTyping: () => void;
  decrementTyping: () => void;
  resetTyping: () => void;
  setHasActiveJob: (v: boolean) => void;
  reset: () => void;
}

export const usePendingReplyStore = create<PendingReplyState & PendingReplyActions>((set) => ({
  typingCount: 0,
  hasActiveJob: false,

  incrementTyping: () => set((state) => ({ typingCount: state.typingCount + 1 })),
  decrementTyping: () => set((state) => ({ typingCount: Math.max(0, state.typingCount - 1) })),
  resetTyping: () => set({ typingCount: 0 }),
  setHasActiveJob: (v) => set({ hasActiveJob: v }),
  reset: () => set({ typingCount: 0, hasActiveJob: false }),
}));
