import type { Me } from '../api/types';
import type { TabKey } from '../store/ui';

export type TabDef = { key: TabKey; label: string; count?: number };

/** Какие вкладки видит человек — зависит от роли */
export function tabsBase(me: Me): TabDef[] {
  // точки Яндекс/Узум: только заказ (и график, если работают в Рассвете по выходным)
  if (me.orderer && !me.isAdmin) {
    return me.grWe && me.grTab ? [{ key: 'order', label: 'Заказ' }, { key: 'grafik', label: 'График' }] : [{ key: 'order', label: 'Заказ' }];
  }
  const t: TabDef[] = [
    { key: 'today', label: 'Сегодня' }, { key: 'count', label: 'Закрытие' }, { key: 'cash', label: 'Наличные' },
    { key: 'tasks', label: 'Задачи', count: me.openTasks || 0 }, { key: 'events', label: 'События' },
    { key: 'fridge', label: 'Холодильник' }, { key: 'tk', label: 'Техкарты' }, { key: 'regs', label: 'Регламент' },
  ];
  // владельцам и управляющим «График» не нужен
  if (me.isAdmin || (me.grTab && !me.isOwner && (me.statuses || {})[me.name] !== 'управляющий')) t.splice(5, 0, { key: 'grafik', label: 'График' });
  if (me.isAdmin) t.push({ key: 'preps', label: 'Заготовки' }, { key: 'staff', label: 'Команда' }, { key: 'history', label: 'История' });
  else if (me.isViewer) t.push({ key: 'history', label: 'История' });   // админ-наблюдатель: + история закрытий
  return t;
}

/** Свой порядок вкладок (хранится в боте). Новые вкладки встают на своё обычное место */
export function sortTabs(t: TabDef[], tabOrder: string | undefined): TabDef[] {
  const ord = String(tabOrder || '').split(',').filter((k, i, a) => k && a.indexOf(k) === i);
  if (!ord.length) return t;
  const by: Record<string, TabDef> = {};
  t.forEach(x => { by[x.key] = x; });
  const out = ord.filter(k => by[k]).map(k => by[k]);
  t.forEach((x, i) => { if (out.indexOf(x) < 0) out.splice(Math.min(i, out.length), 0, x); });
  return out;
}

export const tabsList = (me: Me) => sortTabs(tabsBase(me), me.tabOrder);
