import { lazy, Suspense, type ComponentType } from 'react';
import { useMe } from '../api/queries';
import { Overlays } from '../components/overlays';
import { Loader } from '../components/ui';
import { goTab, useUi, type TabKey } from '../store/ui';
import { useCountStore } from '../features/count/store';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { TodayView } from '../features/today/TodayView';
import { CountView } from '../features/count/CountView';
import { OrderView } from '../features/order/OrderView';

// Вкладки, которые открывают реже, грузятся отдельными кусочками — первый запуск быстрее
const views: Record<TabKey, ComponentType> = {
  today: TodayView,
  count: CountView,
  order: OrderView,
  cash: lazy(() => import('../features/cash/CashView')),
  tasks: lazy(() => import('../features/tasks/TasksView')),
  events: lazy(() => import('../features/events/EventsView')),
  grafik: lazy(() => import('../features/grafik/GrafikView')),
  fridge: lazy(() => import('../features/fridge/FridgeView')),
  tk: lazy(() => import('../features/tk/TkView')),
  regs: lazy(() => import('../features/regs/RegsView')),
  profile: lazy(() => import('../features/profile/ProfileView')),
  preps: lazy(() => import('../features/admin/PrepsView')),
  staff: lazy(() => import('../features/admin/StaffView')),
  history: lazy(() => import('../features/admin/HistoryView')),
};

export function App() {
  const me = useMe();
  const tab = useUi(s => s.tab);
  const View = views[tab];
  const select = (t: TabKey) => { useCountStore.setState({ lastResult: null }); goTab(t); };

  return (
    <>
      <Header me={me} tab={tab} onProfile={() => { if (tab !== 'profile') goTab('profile'); }} />
      <TabBar me={me} tab={tab} onSelect={select} />
      <main id="main">
        <Suspense fallback={<Loader small />}>
          <View key={tab} />
        </Suspense>
      </main>
      <Overlays />
    </>
  );
}
