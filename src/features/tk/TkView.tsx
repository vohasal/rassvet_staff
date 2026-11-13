import { useState } from 'react';
import { qk, queryClient, useMe, useTk } from '../../api/queries';
import type { TechCard } from '../../api/types';
import { Await, Card, Empty } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { q } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { toast } from '../../store/ui';
import { openTk } from './TkSheet';

export default function TkView() {
  const query = useTk();
  return <Await q={query}>{all => <TkList all={all} />}</Await>;
}

function TkList({ all }: { all: TechCard[] }) {
  const me = useMe();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  if (!all.length) return <Empty icon="📖" title="Техкарт не найдено" text="Бот читает лист «Заготовки» в таблице техкарт." />;
  const cards = all.filter(c => !c.hidden), hidden = all.filter(c => c.hidden);

  const refresh = async () => {
    setRefreshing(true);
    try { queryClient.setQueryData(qk.tk, (await call<{ cards: TechCard[] }>('tk', { refresh: true })).cards); toast('Техкарты обновлены ✅'); }
    catch (e) { toast(errMsg(e)); }
    setRefreshing(false);
  };
  // «Убрать» — скрыть у команды, таблица не меняется
  const setHidden = async (c: TechCard, hide: boolean) => {
    if (hide && !(await confirmBox(`Убрать «${c.title}» из приложения? В таблице техкарта останется.`))) return;
    setBusy(c.id);
    try {
      await call('tkHide', { id: c.id, hidden: hide });
      queryClient.setQueryData<TechCard[]>(qk.tk, l => l?.map(x => (x.id === c.id ? { ...x, hidden: hide } : x)));
      haptic('success');
    } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };

  const row = (c: TechCard, isHidden: boolean) => {
    const y = c.yields?.find(y => y && y.n);
    return (
      <div key={c.id} className="tkrow" style={isHidden ? { opacity: 0.6, cursor: 'default' } : undefined}
        onClick={isHidden ? undefined : () => openTk(c, me.preps.find(x => x.tk === c.id), null)}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--olive)', color: 'var(--cream)', display: 'grid', placeItems: 'center', fontWeight: 600, flex: '0 0 auto' }}>
          {(c.title[0] || '•').toUpperCase()}
        </div>
        <div className="pname"><b>{c.title}</b><span>{y ? 'выход ' + q(y.n) + ' ' + (y.u || '') : 'выход не указан'}{c.shelf ? ' · хранится ' + c.shelf : ''}</span></div>
        {me.isAdmin
          ? <button className="tkbtn" disabled={busy === c.id} onClick={e => { e.stopPropagation(); setHidden(c, !isHidden); }}>{isHidden ? 'Вернуть' : 'Убрать'}</button>
          : <span style={{ color: 'var(--muted)', fontSize: 20 }}>›</span>}
      </div>
    );
  };

  return (
    <>
      <Card>
        <h2>Техкарты заготовок</h2>
        <p className="sub">Нажми, чтобы открыть рецепт и пересчитать количество{me.isAdmin ? '. «Убрать» — скрыть у команды, таблица не меняется' : ''}</p>
        {me.isAdmin && <button className="btn soft" style={{ margin: '0 0 6px', padding: 11 }} disabled={refreshing} onClick={refresh}>{refreshing ? 'Читаю таблицу…' : '🔄 Обновить из таблицы'}</button>}
        {cards.length ? cards.map(c => row(c, false)) : <p className="sub">Все техкарты скрыты</p>}
      </Card>
      {me.isAdmin && hidden.length > 0 && (
        <Card><h2>Убранные</h2><p className="sub">Команда их не видит</p>{hidden.map(c => row(c, true))}</Card>
      )}
    </>
  );
}
