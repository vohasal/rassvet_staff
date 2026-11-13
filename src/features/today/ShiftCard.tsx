import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchers, qk, queryClient, refreshMe, useShiftDay } from '../../api/queries';
import type { HomeData, Me, ShiftEntry } from '../../api/types';
import { Avatar, StBadge } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { addD, dayUTC, diffD, hmS } from '../../lib/format';
import { hapticSelect } from '../../lib/telegram';
import { toast } from '../../store/ui';
import { useTodayStore } from './store';

// График «На смене»: неделя назад и неделя вперёд, листается свайпом
const DAYS_BACK = 7, DAYS_FWD = 7;
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function ShiftCard({ me }: { me: Me }) {
  const today = me.today.date;
  const curDay = useTodayStore(s => s.curDay) || today;
  const [shown, setShown] = useState(curDay);           // день, который сейчас нарисован (после анимации)
  const [anim, setAnim] = useState('');
  const [busy, setBusy] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const smooth = useRef(false);
  const diff = diffD(curDay, today);

  // соседние дни — заранее, чтобы листалось без ожидания
  useEffect(() => {
    [-1, 1, -2, 2].forEach(k => {
      const d = addD(curDay, k);
      if (Math.abs(diffD(d, today)) <= DAYS_BACK && d !== today) queryClient.prefetchQuery({ queryKey: qk.shift(d), queryFn: () => fetchers.shift(d) });
    });
  }, [curDay, today]);

  // выбранный день — по центру полосы
  useEffect(() => {
    const strip = stripRef.current, on = strip?.querySelector<HTMLElement>('.dchip.on');
    if (strip && on) strip.scrollTo({ left: on.offsetLeft - strip.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2, behavior: smooth.current ? 'smooth' : 'auto' });
  }, [curDay]);

  const goDay = (n: number) => {
    const nd = addD(curDay, n), df = diffD(nd, today);
    if (df < -DAYS_BACK || df > DAYS_FWD) return;
    smooth.current = true;
    useTodayStore.setState({ curDay: nd });
    setAnim(n > 0 ? 'out-l' : 'out-r');
    setTimeout(() => { setShown(nd); setAnim(''); }, 160);
    hapticSelect();
  };

  const swipe = useRef<{ x: number; y: number } | null>(null);

  const refreshSchedule = async () => {
    setBusy(true);
    try {
      await call('refreshSchedule');
      queryClient.removeQueries({ queryKey: ['shift'] });
      queryClient.removeQueries({ queryKey: qk.home });
      queryClient.removeQueries({ queryKey: qk.cfg });
      await refreshMe();
      toast('График обновлён ✅');
    } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };

  const chips = [];
  for (let i = -DAYS_BACK; i <= DAYS_FWD; i++) {
    const d = addD(today, i), dt = new Date(d + 'T12:00:00Z');
    chips.push(
      <button key={d} className={'dchip' + (d === today ? ' today' : '') + (d === curDay ? ' on' : '') + (dt.getUTCDay() === 1 && i !== -DAYS_BACK ? ' wk' : '')}
        onClick={() => { const n = diffD(d, curDay); if (n) goDay(n); }}>
        <small>{WD[dt.getUTCDay()]}</small><b>{dt.getUTCDate()}</b>
      </button>,
    );
  }

  return (
    <div className="card" id="shiftCard">
      <div className="dayhead">
        <button className="navb" disabled={diff <= -DAYS_BACK} onClick={() => goDay(-1)}>‹</button>
        <div className="grow">
          <h2>На смене</h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>
            {dayUTC(curDay, { weekday: 'long', day: 'numeric', month: 'long' })}
            {diff === 0 ? ' · сегодня' : diff === 1 ? ' · завтра' : diff === -1 ? ' · вчера' : ''}
          </p>
        </div>
        <button className="navb" disabled={diff >= DAYS_FWD} onClick={() => goDay(1)}>›</button>
      </div>
      <div className="strip" ref={stripRef}>{chips}</div>
      <div id="dayBody" className={anim}
        onTouchStart={e => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          const s = swipe.current; if (!s) return; swipe.current = null;
          const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) goDay(dx < 0 ? 1 : -1);
        }}>
        <DayBody me={me} date={shown} />
      </div>
      {me.isAdmin && (
        <button className="btn soft" style={{ padding: 10, marginTop: 10, fontSize: 14 }} disabled={busy} onClick={refreshSchedule}>
          {busy ? 'Читаю таблицу…' : '🔄 Обновить график из таблицы'}
        </button>
      )}
    </div>
  );
}

function DayBody({ me, date }: { me: Me; date: string }) {
  const today = me.today.date;
  const q = useShiftDay(date, date === today ? (me.shift ?? null) : undefined);
  const home = useQuery<HomeData>({ queryKey: qk.home, queryFn: fetchers.home, enabled: false }).data;   // только для 🎂, сам не грузит
  if (q.isError && q.data === undefined) return <div className="wip">Не удалось загрузить</div>;
  const list = q.data;
  if (list === undefined) return <div className="wip">Загружаю…</div>;
  if (list === null || (!list.length && date >= today)) return <div className="wip"><div className="big">✍️</div><b>График в процессе</b>Расписание на этот день ещё не готово</div>;
  if (!list.length) return <div className="wip"><div className="big">🌙</div><b>Никого в графике</b></div>;
  return <DayRows me={me} date={date} list={list} bdays={home?.bdays || {}} />;
}

// сначала команда Рассвета, ниже отдельными блоками те, кто работает в другом месте (Узум, Яндекс, Amway, кейтеринг…)
const pointRe = /яндекс|узум/i;
const placeOf = (x: ShiftEntry) => (x.place !== undefined ? x.place : (String(x.name).match(pointRe) || [''])[0].replace(/^./, c => c.toUpperCase()));
const boss = (p: string) => /^(Управляющий|Владелец)$/.test(p);
const people = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'человек' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'человека' : 'человек');

function DayRows({ me, date, list, bdays }: { me: Me; date: string; list: ShiftEntry[]; bdays: Record<string, string> }) {
  const isToday = date === me.today.date, now = me.now || 0;
  const bar = list.filter(x => !placeOf(x)), places: string[] = [];
  list.forEach(x => { const p = placeOf(x); if (p && places.indexOf(p) < 0) places.push(p); });
  places.sort((p, q) => Number(boss(q)) - Number(boss(p)));   // руководство — сразу под командой Рассвета
  const statuses = me.statuses || {};

  const row = (x: ShiftEntry, k: number) => {
    const cls = isToday && x.to ? (now >= x.from && now < x.to ? 'now' : now >= x.to ? 'past' : '') : '';
    const sub = !x.to ? 'на выезде' : isToday ? (cls === 'now' ? 'сейчас на смене' : cls === 'past' ? 'смена закончилась' : 'придёт в ' + hmS(x.from)) : x.from < 12 * 60 ? 'утро' : 'вечер';
    const away = !!placeOf(x), shown = String(x.name).replace(pointRe, '').replace(/\s+/g, ' ').trim() || x.name;
    return (
      <div className={'shift ' + cls} key={x.name + k}>
        <Avatar name={shown} />
        <div className="pname">
          <b>
            {shown}{x.name === me.name && <> <span className="mini">ты</span></>}
            {bdays[x.name] === date.slice(5) ? ' 🎂' : ''}
            <StBadge st={statuses[x.name]} />
            {x.role && <span className="mini">{x.role}</span>}
            {!away && x.to >= 22 * 60 && <span className="mini close">закрывает</span>}
          </b>
          <span>{sub}</span>
        </div>
        <span className="time">{x.word ? x.word : hmS(x.from) + ' – ' + hmS(x.to)}</span>
      </div>
    );
  };
  const n = bar.length;
  return (
    <>
      {n ? <><p className="sub" style={{ margin: '4px 0 0' }}>Рассвет · {n} {people(n)} на смене</p>{bar.map(row)}</>
        : <p className="sub" style={{ margin: '4px 0 0' }}>Из команды Рассвета в графике никого</p>}
      {places.map(p => (
        <div key={p} style={{ display: 'contents' }}>
          <p className="sub" style={{ margin: '14px 0 0' }}>{boss(p) ? '👔' : '📍'} <b>{p}</b>{/^(Яндекс|Узум)$/.test(p) ? ' · офис на нашей точке' : ''}</p>
          {list.filter(x => placeOf(x) === p).map(row)}
        </div>
      ))}
    </>
  );
}
