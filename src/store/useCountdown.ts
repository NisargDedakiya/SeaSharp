import { create } from "zustand";

type CountdownState = {
  deadlines: Record<string, string>; // rfqId -> ISO deadline
  now: number;
  register: (rfqId: string, deadlineIso: string) => void;
  tick: () => void;
};

// Lightweight global store for live auction countdowns (spec section 14:
// Zustand for "live bids, shipping coordinates, auction timers"). Keeping
// deadlines centralized means multiple RFQ cards on the same page share one
// ticking clock instead of each mounting its own interval.
export const useCountdown = create<CountdownState>((set) => ({
  deadlines: {},
  now: Date.now(),
  register: (rfqId, deadlineIso) =>
    set((state) => ({ deadlines: { ...state.deadlines, [rfqId]: deadlineIso } })),
  tick: () => set({ now: Date.now() }),
}));

export function formatTimeRemaining(deadlineIso: string, now: number): string {
  const diffMs = new Date(deadlineIso).getTime() - now;
  if (diffMs <= 0) return "Bidding closed";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const seconds = Math.floor((diffMs / 1000) % 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m ${seconds}s remaining`;
}
