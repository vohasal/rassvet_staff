import type { ReactNode } from 'react';
import { create } from 'zustand';

export type TabKey =
  | 'today' | 'count' | 'cash' | 'tasks' | 'events' | 'grafik' | 'fridge' | 'tk' | 'regs'
  | 'preps' | 'staff' | 'history' | 'order' | 'profile';

interface UiState {
  tab: TabKey;
  toast: { text: string; id: number } | null;
  sheet: ReactNode | null;      // нижняя шторка (одна за раз, как и раньше)
  lightbox: string | null;      // фото на весь экран
  setTab(t: TabKey): void;
}

export const useUi = create<UiState>(set => ({
  tab: 'today',
  toast: null,
  sheet: null,
  lightbox: null,
  setTab: tab => set({ tab }),
}));

let toastSeq = 0;
export const toast = (text: string) => useUi.setState({ toast: { text, id: ++toastSeq } });

export const openSheet = (node: ReactNode) => useUi.setState({ sheet: node });
export const closeSheet = () => useUi.setState({ sheet: null });

export const lightbox = (src: string) => useUi.setState({ lightbox: src });

/** Переключить вкладку и прокрутить наверх */
export const goTab = (t: TabKey) => { useUi.getState().setTab(t); window.scrollTo(0, 0); };
