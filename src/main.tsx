import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import { App } from './app/App';
import { initKeyboard } from './app/keyboard';
import { prefetch, qk, queryClient, fetchers } from './api/queries';
import { API_URL, errMsg } from './lib/api';
import { applyTheme, getTg } from './lib/telegram';
import { Empty, Loader } from './components/ui';
import { useUi } from './store/ui';
import { loadDraft } from './features/count/store';
import { toast } from './store/ui';

const root = createRoot(document.getElementById('app')!);
const fail = (icon: string, title: string, text = '') =>
  root.render(<main style={{ paddingTop: 40 }}><Empty icon={icon} title={title} text={text} /></main>);

async function boot() {
  // Локальная разработка: npm run dev → открой http://localhost:5173/?mock — фейковый Телеграм и сервер
  const mock = import.meta.env.DEV && new URLSearchParams(location.search).has('mock');
  if (mock) await (await import('./mock')).installMock();

  const tg = getTg();
  if (!tg || !tg.initData) return fail('📱', 'Открой через бота', 'Приложение работает только внутри Телеграма.');
  tg.ready(); tg.expand();
  applyTheme();
  try { tg.onEvent('themeChanged', applyTheme); } catch { /* старый клиент */ }
  try { tg.disableVerticalSwipes?.(); } catch { /* старый клиент */ }
  if (!API_URL && !mock) return fail('🔌', 'Нет адреса сервера', 'Открой приложение кнопкой в боте.');

  root.render(<Loader />);
  try {
    const me = await queryClient.fetchQuery({ queryKey: qk.me, queryFn: fetchers.me });
    // с какой вкладки начать
    const restored = me.canClose && loadDraft();
    const h = new Date().getHours();
    let tab = useUi.getState().tab;
    if (me.canClose && (h >= 20 || h < 3)) tab = 'count';
    if (me.orderer && !me.isAdmin) tab = 'order';
    if (restored) tab = 'count';
    useUi.setState({ tab });

    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
      </StrictMode>,
    );
    prefetch(me);
    if (restored) setTimeout(() => toast('Черновик закрытия восстановлен ✍️'), 400);
    initKeyboard();
  } catch (e) {
    fail('🔒', errMsg(e));
  }
}

boot();
