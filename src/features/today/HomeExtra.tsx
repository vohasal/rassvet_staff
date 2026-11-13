// «Мои смены», замены, дни рождения, проблемы + генуборка и передача склада
import { useState } from 'react';
import { refreshHome, useHome } from '../../api/queries';
import type { HomeData, Me } from '../../api/types';
import { Card } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { addD, dayUTC, fmtTs, hmS } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { openSheet, toast } from '../../store/ui';
import { GuCard, SkCard } from './cards';
import { chooseSwapMode, DishSheet, ProblemSheet } from './sheets';

export function HomeExtra({ me }: { me: Me }) {
  const q = useHome();
  if (!q.data) return <Card><div className="wip">Загружаю…</div></Card>;
  return <HomeExtraBody me={me} d={q.data} />;
}

function HomeExtraBody({ me, d }: { me: Me; d: HomeData }) {
  const [busy, setBusy] = useState<string | null>(null);   // кнопка, по которой ждём ответа
  const today = me.today.date;
  const reload = () => refreshHome().catch(() => {});

  const askSwap = async (date: string) => {
    const mode = await chooseSwapMode(dayUTC(date, { day: 'numeric', month: 'long' }));
    if (!mode) return;
    setBusy('swap' + date);
    try { await call('swapAsk', { date, mode }); toast('Запрос отправлен в группу 🔄'); await reload(); } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };
  const take = async (id: string, mode: string) => {
    if (!(await confirmBox(mode === 'swap'
      ? 'Поменяться сменой? Если у тебя в этот день смена — поменяетесь временем, если выходной — заберёшь смену. Админ подтвердит.'
      : 'Взять эту смену? Админ подтвердит замену.'))) return;
    setBusy('take' + id);
    try {
      let r = await call<{ needConfirm?: boolean; ask?: string }>('swapTake', { id });
      // у тебя в этот день уже своя смена — переспросить
      if (r.needConfirm) {
        if (!(await confirmBox(r.ask || ''))) { setBusy(null); return; }
        r = await call('swapTake', { id, confirm: true });
      }
      haptic('success'); toast('Отлично! Ждём подтверждения 🙌'); await reload();
    } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };
  const cancelSwap = async (id: string) => {
    if (!(await confirmBox('Отменить поиск замены?'))) return;
    try { await call('swapCancel', { id }); await reload(); } catch (e) { toast(errMsg(e)); }
  };
  const probDone = async (id: string) => {
    if (!(await confirmBox('Отметить проблему решённой? Автор получит уведомление.'))) return;
    try { await call('probDone', { id }); haptic('success'); await reload(); } catch (e) { toast(errMsg(e)); }
  };

  const shortDay = (date: string) => dayUTC(date, { weekday: 'short', day: 'numeric', month: 'short' });
  const swaps = d.swaps || [];
  const others = swaps.filter(w => !w.mine || me.isAdmin);
  // дни рождения на неделю вперёд
  const bd = d.bdays || {}, soon: [string, number, string][] = [];
  for (let i = 0; i < 8; i++) { const dd = addD(today, i), md = dd.slice(5); Object.keys(bd).forEach(n => { if (bd[n] === md) soon.push([n, i, dd]); }); }
  const pr = d.probs || [];

  return (
    <>
      <SkCard me={me} />
      <GuCard me={me} />
      {/* мои смены на 7 дней (у админа скрыто — мешает) */}
      {d.week && d.week.length > 0 && !me.isAdmin && (
        <Card>
          <h2>Мои смены</h2><p className="sub">Ближайшие 7 дней</p>
          {d.week.map(w => {
            const lbl = w.date === today ? 'сегодня' : shortDay(w.date);
            const sw = swaps.find(x => x.mine && x.date === w.date);
            return (
              <div key={w.date} className={'shift' + (w.off || w.none ? ' past' : '')}>
                <div className="pname"><b style={{ textTransform: 'capitalize' }}>{lbl}</b>{w.role ? <span>{w.role}</span> : null}</div>
                {w.none ? <span className="sub" style={{ margin: 0 }}>график в процессе</span>
                  : w.off ? <span className="mini">выходной</span>
                  : <span className="time">{hmS(w.from)} – {hmS(w.to)}</span>}
                {!w.none && !w.off && w.date > today && (sw
                  ? <span className="mini" style={{ background: 'var(--warm-soft)', color: 'var(--warm)' }}>
                    {sw.status === 'taken' ? (sw.mode === 'swap' ? 'обмен: ' : 'замена: ') + sw.takerName : sw.mode === 'swap' ? 'ищем обмен' : 'ищем замену'}
                  </span>
                  : <button className="tkbtn" style={{ marginLeft: 6 }} disabled={busy === 'swap' + w.date} onClick={() => askSwap(w.date)}>Замена</button>)}
              </div>
            );
          })}
        </Card>
      )}
      {/* кто ищет замену */}
      {others.length > 0 && (
        <Card>
          <h2>🔄 Ищут замену</h2>
          {others.map(w => (
            <div className="shift" key={w.id}>
              <div className="pname">
                <b>{w.byName}</b> <span className="mini">{w.mode === 'swap' ? '🔄 обмен' : '🙋 отдаёт'}</span>
                <span>{shortDay(w.date)} · {hmS(w.from)}–{hmS(w.to)}{w.status === 'taken' ? ' · ' + (w.mode === 'swap' ? 'меняется ' : 'берёт ') + w.takerName : ''}</span>
              </div>
              {w.status === 'open' && !w.mine && (
                <button className="tkbtn" disabled={busy === 'take' + w.id} onClick={() => take(w.id, w.mode === 'swap' ? 'swap' : 'give')}>{w.mode === 'swap' ? '🔄 Поменяюсь' : '🙋 Возьму'}</button>
              )}
              {(w.mine || me.isAdmin) && <button className="x" onClick={() => cancelSwap(w.id)}>×</button>}
            </div>
          ))}
        </Card>
      )}
      {soon.length > 0 && (
        <Card>
          <h2>🎂 Дни рождения</h2>
          {soon.map(([n, i, dd]) => (
            <div className="shift" key={n + dd}>
              <div className="ava">🎂</div>
              <div className="pname"><b>{n}</b>
                <span>{i === 0 ? <b style={{ color: 'var(--warm)' }}>сегодня! поздравь 🎉</b> : i === 1 ? 'завтра' : dayUTC(dd, { day: 'numeric', month: 'long' })}</span>
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <h2>⚠️ Проблемы</h2>
        <p className="sub">{pr.length ? 'Открытые — ждут решения' : 'Что-то сломалось или закончилось? Сообщи — админ сразу узнает'}</p>
        {pr.map(p => (
          <div className="task" key={p.id}>
            <div className="pname"><b>{p.text}</b><span>{p.byName} · {fmtTs(p.at)}{p.photos ? ' · 📷 ' + p.photos : ''}</span></div>
            {me.canCreate && <button className="tkbtn" onClick={() => probDone(p.id)}>✅ Решено</button>}
          </div>
        ))}
        {!(me.orderer && !me.isAdmin) && <>
          <button className="btn soft" onClick={() => openSheet(<ProblemSheet done={reload} />)}>⚠️ Сообщить о проблеме</button>
          <button className="btn soft" style={{ marginTop: 8 }} onClick={() => openSheet(<DishSheet />)}>🍽 Заказать посуду</button>
        </>}
      </Card>
    </>
  );
}
