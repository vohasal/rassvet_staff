import { QueryClient, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { call } from '../lib/api';
import type {
  BookingsData, CardData, CashData, Closing, Config, EventsData, FridgeData, GrafikData,
  HomeData, Me, RegDoc, ShiftEntry, TasksData, TechCard,
} from './types';

// Данные держим, пока их явно не сбросят (как и раньше: загрузили один раз — показываем из памяти).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, gcTime: Infinity, retry: false, refetchOnWindowFocus: false },
  },
});

export const qk = {
  me: ['me'] as const,
  tk: ['tk'] as const,
  cfg: ['config'] as const,
  home: ['home'] as const,
  shift: (date: string) => ['shift', date] as const,
  cash: ['cash'] as const,
  tasks: ['tasks'] as const,
  events: ['events'] as const,
  bookings: ['bookings'] as const,
  fridge: ['fridge'] as const,
  card: (name: string) => ['card', name] as const,
  grafik: ['grafik'] as const,
  history: ['history'] as const,
  regs: ['regs'] as const,
};

export const fetchers = {
  me: () => call<Me>('me'),
  tk: () => call<{ cards: TechCard[] }>('tk').then(r => r.cards),
  cfg: () => call<Config>('config'),
  home: () => call<HomeData>('home'),
  shift: (date: string) => call<{ list: ShiftEntry[] | null }>('shiftDay', { date }).then(r => r.list),
};

// ===== «Я» — главный объект: кто я, права, заготовки, сегодняшний список =====
export const useMe = () => useSuspenseQuery({ queryKey: qk.me, queryFn: fetchers.me }).data;
export const getMe = () => queryClient.getQueryData<Me>(qk.me)!;
/** Перечитать «me» с сервера (после любого действия, меняющего данные) */
export const refreshMe = () => queryClient.fetchQuery({ queryKey: qk.me, queryFn: fetchers.me, staleTime: 0 });
/** Поправить «me» на месте, без запроса */
export const patchMe = (p: Partial<Me>) => queryClient.setQueryData<Me>(qk.me, m => (m ? { ...m, ...p } : m));

export const getTk = () => queryClient.ensureQueryData({ queryKey: qk.tk, queryFn: fetchers.tk });
export const getCfg = () => queryClient.ensureQueryData({ queryKey: qk.cfg, queryFn: fetchers.cfg });

/** Данные устарели: открытая вкладка перезагрузит их сразу, остальные — при следующем показе */
export const invalidate = (key: readonly unknown[]) => queryClient.invalidateQueries({ queryKey: key });

export function prefetch(me: Me) {
  getTk().catch(() => {});
  if (me.isAdmin) getCfg().catch(() => {});
}

// ===== Вкладки =====
export const useTk = () => useQuery({ queryKey: qk.tk, queryFn: fetchers.tk });
export const useCfg = () => useQuery({ queryKey: qk.cfg, queryFn: fetchers.cfg });
// «Сегодня»: показываем, что есть в памяти, и сразу обновляем
export const useHome = () => useQuery({ queryKey: qk.home, queryFn: fetchers.home, refetchOnMount: 'always' });
// на сегодня график уже пришёл вместе с «me» — его и показываем, без запроса
export const useShiftDay = (date: string, initial?: ShiftEntry[] | null) =>
  useQuery({ queryKey: qk.shift(date), queryFn: () => fetchers.shift(date), initialData: initial });
export const refreshHome = () => queryClient.fetchQuery({ queryKey: qk.home, queryFn: fetchers.home, staleTime: 0 });
// «Наличные»: каждый раз свежие (касса меняется у всех)
export const useCash = () => useQuery({ queryKey: qk.cash, queryFn: () => call<CashData>('cash'), refetchOnMount: 'always' });
export const useTasks = () => useQuery({ queryKey: qk.tasks, queryFn: () => call<TasksData>('tasks') });
export const useEvents = () => useQuery({ queryKey: qk.events, queryFn: () => call<EventsData>('events') });
export const useBookings = () => useQuery({ queryKey: qk.bookings, queryFn: () => call<BookingsData>('bookings') });
export const useFridge = () => useQuery({ queryKey: qk.fridge, queryFn: () => call<FridgeData>('fridge') });
export const useCard = (name: string, other: boolean) =>
  useQuery({ queryKey: qk.card(name), queryFn: () => call<CardData>('card', other ? { name } : null) });
export const useGrafik = () => useQuery({ queryKey: qk.grafik, queryFn: () => call<GrafikData>('grafik') });
export const useHistory = () => useQuery({ queryKey: qk.history, queryFn: () => call<{ items: Closing[] }>('history').then(r => r.items) });
export const useRegs = () => useQuery({ queryKey: qk.regs, queryFn: () => call<{ docs: RegDoc[] }>('regs').then(r => r.docs) });
