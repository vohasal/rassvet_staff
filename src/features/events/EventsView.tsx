import { useState } from 'react';
import { create } from 'zustand';
import { invalidate, qk, useBookings, useEvents } from '../../api/queries';
import type { Audience, BookingsData, EventsData } from '../../api/types';
import { AudiencePicker, emptyAudience } from '../../components/AudiencePicker';
import { Card, ErrorCard, Loader } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { addD, tashDay, toNum } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { toast } from '../../store/ui';

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const guests = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'гость' : [2, 3, 4].indexOf(n % 10) >= 0 && (n % 100 < 12 || n % 100 > 14) ? 'гостя' : 'гостей');

// формы живут между вкладками (недописанное не теряется)
const newBooking = () => ({ guest: '', people: '', phone: '', date: tashDay(), time: '19:00', note: '' });
const newEvent = () => ({ title: '', date: tashDay(), time: '18:00', note: '', to: emptyAudience() as Audience });
const useForms = create(() => ({ bkOpen: false, bk: newBooking(), ev: newEvent() }));

export default function EventsView() {
  const ev = useEvents(), bk = useBookings();
  if (ev.data && bk.data) return <Events d={ev.data} b={bk.data} />;
  if (ev.error || bk.error) return <ErrorCard error={ev.error || bk.error} />;
  return <Loader small />;
}

function Events({ d, b }: { d: EventsData; b: BookingsData }) {
  const todayD = tashDay(), tmrD = addD(todayD, 1);
  const bkDay = (dt: string) => (dt === todayD ? 'сегодня' : dt === tmrD ? 'завтра' : new Date(dt + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }));
  const delBooking = async (id: string) => {
    if (!(await confirmBox('Удалить бронь? Напоминания не будет.'))) return;
    try { await call('bookingDel', { id }); invalidate(qk.bookings); } catch (e) { toast(errMsg(e)); }
  };
  const delEvent = async (id: string) => {
    if (!(await confirmBox('Отменить событие? Всем приглашённым придёт уведомление.'))) return;
    try { await call('eventDel', { id, notify: true }); invalidate(qk.events); } catch (e) { toast(errMsg(e)); }
  };
  return (
    <>
      <Card>
        <h2>📌 Брони</h2>
        <p className="sub">{b.bookings.length ? 'За час до брони бот напомнит в группе и отметит тех, кто на смене' : 'Броней пока нет. За час до брони бот напомнит в группе и отметит тех, кто на смене'}</p>
        {b.bookings.map(x => (
          <div className="ev" key={x.id}>
            <div className="bk-when"><div><b>{x.time}</b><small>{bkDay(x.date)}</small></div></div>
            <div className="pname">
              <b>{x.guest} · {x.people} {guests(x.people)}</b>
              <span>{x.phone ? <>📞 <a href={'tel:' + x.phone.replace(/[^\d+]/g, '')} style={{ color: 'inherit' }}>{x.phone}</a> · </> : null}внёс(ла) {x.byName}</span>
              {x.note ? <span style={{ display: 'block', marginTop: 4, color: 'var(--forest-2)' }}>💬 {x.note}</span> : null}
            </div>
            {x.canDel && <button className="x" onClick={() => delBooking(x.id)}>×</button>}
          </div>
        ))}
      </Card>
      {b.canAdd && <NewBooking />}
      <Card>
        <h2>События</h2>
        <p className="sub">{d.events.length ? 'Ближайшие собрания и встречи' : 'Пока ничего не запланировано'}</p>
        {d.events.map(e => {
          const dt = new Date(e.date + 'T12:00');
          return (
            <div className="ev" key={e.id}>
              <div className="evd"><div><b>{dt.getDate()}</b><small>{MON[dt.getMonth()]}</small></div></div>
              <div className="pname">
                <b>{e.title}</b>
                <span>{dt.toLocaleDateString('ru-RU', { weekday: 'long' })} в {e.time} · 👥 {e.to}</span>
                {e.note ? <span style={{ display: 'block', marginTop: 4, color: 'var(--forest-2)' }}>{e.note}</span> : null}
              </div>
              {e.canDel && <button className="x" onClick={() => delEvent(e.id)}>×</button>}
            </div>
          );
        })}
      </Card>
      {d.canCreate && <NewEvent d={d} />}
    </>
  );
}

function NewBooking() {
  const { bk, bkOpen } = useForms();
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof bk>) => useForms.setState(s => ({ bk: { ...s.bk, ...p } }));
  const add = async () => {
    const guest = bk.guest.trim(), people = toNum(bk.people.trim()), date = bk.date.trim(), time = bk.time.trim();
    if (!guest) return toast('Напиши, на кого бронь');
    if (!(Number(people) >= 1)) return toast('Сколько гостей?');
    if (!date || !time) return toast('Укажи дату и время');
    setBusy(true);
    try {
      await call('bookingAdd', { guest, people, date, time, phone: bk.phone.trim(), note: bk.note.trim() });
      haptic('success'); toast('Бронь добавлена 📌');
      useForms.setState({ bk: newBooking(), bkOpen: false });
      invalidate(qk.bookings);
    } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };
  return (
    <details className="card" open={bkOpen} onToggle={e => useForms.setState({ bkOpen: (e.currentTarget as HTMLDetailsElement).open })}>
      <summary><div className="pname"><h2>＋ Новая бронь</h2><p className="sub">Гость забронировал стол — внеси сюда</p></div></summary>
      <div className="form">
        <label>На кого<input placeholder="Имя гостя" value={bk.guest} onChange={e => set({ guest: e.target.value })} /></label>
        <div className="two">
          <label>Гостей<input inputMode="numeric" placeholder="2" value={bk.people} onChange={e => set({ people: e.target.value })} /></label>
          <label>Телефон<input inputMode="tel" placeholder="необязательно" value={bk.phone} onChange={e => set({ phone: e.target.value })} /></label>
        </div>
        <div className="two">
          <label>Дата<input type="date" min={tashDay()} value={bk.date} onChange={e => set({ date: e.target.value })} /></label>
          <label>Время<input type="time" value={bk.time} onChange={e => set({ time: e.target.value })} /></label>
        </div>
        <label>Комментарий<textarea rows={2} placeholder="Стол у окна, день рождения, детский стул…" value={bk.note} onChange={e => set({ note: e.target.value })} /></label>
        <button className="btn" disabled={busy} onClick={add}>{busy ? 'Сохраняю…' : 'Добавить бронь'}</button>
      </div>
    </details>
  );
}

function NewEvent({ d }: { d: EventsData }) {
  const ev = useForms(s => s.ev);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof ev>) => useForms.setState(s => ({ ev: { ...s.ev, ...p } }));
  const add = async () => {
    const title = ev.title.trim(), note = ev.note.trim();
    if (!title) return toast('Напиши, что за событие');
    if (!ev.date || !ev.time) return toast('Укажи дату и время');
    if (ev.to.mode === 'status' && !ev.to.statuses.length) return toast('Выбери статус');
    if (ev.to.mode === 'people' && !ev.to.ids.length) return toast('Выбери людей');
    setBusy(true);
    try {
      await call('eventAdd', { title, date: ev.date, time: ev.time, note, to: ev.to });
      haptic('success'); toast('Событие создано, все уведомлены 📅');
      useForms.setState(s => ({ ev: { ...newEvent(), to: s.ev.to } }));
      invalidate(qk.events);
    } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Card>
      <h2>Новое событие</h2>
      <div className="form">
        <label>Что<input placeholder="Например: собрание команды" value={ev.title} onChange={e => set({ title: e.target.value })} /></label>
        <div className="two">
          <label>Дата<input type="date" min={tashDay()} value={ev.date} onChange={e => set({ date: e.target.value })} /></label>
          <label>Время<input type="time" value={ev.time} onChange={e => set({ time: e.target.value })} /></label>
        </div>
        <label>Комментарий (необязательно)<textarea rows={2} placeholder="Повестка, место…" value={ev.note} onChange={e => set({ note: e.target.value })} /></label>
        <label>Для кого</label>
        <AudiencePicker f={ev.to} d={d} withAdmins onChange={to => set({ to })} />
        <button className="btn" disabled={busy} onClick={add}>{busy ? 'Создаю…' : 'Создать и уведомить'}</button>
      </div>
    </Card>
  );
}
