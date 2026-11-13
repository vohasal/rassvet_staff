import { create } from 'zustand';

// Состояние вкладки «Сегодня», которое живёт между переключениями вкладок
interface TodayState {
  sel: string[];                    // отмеченные «сварил»
  yv: Record<string, string>;       // итоговый выход, который вписали
  fzv: Record<string, string>;      // сколько из сваренного ушло в морозилку
  extraOpen: boolean | null;        // блок «Сварил что-то ещё» (null — по умолчанию)
  curDay: string | null;            // день в карточке «На смене»
}

export const useTodayStore = create<TodayState>(() => ({ sel: [], yv: {}, fzv: {}, extraOpen: null, curDay: null }));
