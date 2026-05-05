import { create } from 'zustand';

interface UiState {
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  theme: 'light',
  openSidebar: () => {
    set({
      isSidebarOpen: true,
    });
  },
  closeSidebar: () => {
    set({
      isSidebarOpen: false,
    });
  },
  toggleSidebar: () => {
    set((state) => ({
      isSidebarOpen: !state.isSidebarOpen,
    }));
  },
  setTheme: (theme) => {
    set({
      theme,
    });
  },
  toggleTheme: () => {
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    }));
  },
}));
