import { create } from 'zustand';

type EasterEggState = {
  isTickerPaused: boolean;
  toggleTickerPaused: () => void;
};

export const useEasterEggStore = create<EasterEggState>((set) => ({
  isTickerPaused: false,
  toggleTickerPaused: () => set((state) => ({ isTickerPaused: !state.isTickerPaused })),
}));
