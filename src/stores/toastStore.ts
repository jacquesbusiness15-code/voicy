import { create } from 'zustand';

type ToastType = 'error' | 'success' | 'info';

interface ToastState {
  message: string | null;
  type: ToastType;
  visible: boolean;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'error',
  visible: false,
  show: (message, type = 'error') => {
    if (dismissTimer) clearTimeout(dismissTimer);
    set({ message, type, visible: true });
    dismissTimer = setTimeout(() => {
      set({ visible: false });
      dismissTimer = null;
    }, 4000);
  },
  hide: () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ visible: false });
  },
}));
