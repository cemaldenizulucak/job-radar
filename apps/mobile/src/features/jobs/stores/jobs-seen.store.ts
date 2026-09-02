import { create } from 'zustand';

type JobsSeenState = {
  seenById: Record<string, true>;
  markSeen: (jobId: string) => void;
  unmarkSeen: (jobId: string) => void;
  clear: () => void;
};

export const useJobsSeenStore = create<JobsSeenState>((set) => ({
  seenById: {},
  markSeen: (jobId) =>
    set((state) =>
      state.seenById[jobId]
        ? state
        : { seenById: { ...state.seenById, [jobId]: true } },
    ),
  unmarkSeen: (jobId) =>
    set((state) => {
      if (!state.seenById[jobId]) {
        return state;
      }

      const next = { ...state.seenById };
      delete next[jobId];
      return { seenById: next };
    }),
  clear: () => set({ seenById: {} }),
}));
