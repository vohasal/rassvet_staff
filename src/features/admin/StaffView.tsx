// Админ: команда бара, статусы и дни рождения, кто подключён к боту, проверка графика
import { useState } from 'react';
import { patchMe, qk, queryClient, useCfg } from '../../api/queries';
import type { Config, HomeData } from '../../api/types';
import { Avatar, Await, Card, StBadge } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { ST_LABEL, ST_LIST } from '../../lib/statuses';
import { confirmBox, haptic, hapticSelect } from '../../lib/telegram';
import { toast } from '../../store/ui';

export default function StaffView() {
  const q = useCfg();
  return <Await q={q}>{cfg => <Staff cfg={cfg} />}</Await>;
}

const setCfg = (patch: Partial<Config>) => queryClient.setQueryData<Config>(qk.cfg, c => (c ? { ...c, ...patch } : c));
const badges = (list?: string[]) => (list && list.length ? list.map(n => <span className="badge" key={n}>{n}</span>) : <span className="sub">никого</span>);

function Staff({ cfg }: { cfg: Config }) {
  const [off, setOff] = useState<string[]>(() => [...(cfg.off || [])]);
  const [extra, setExtra] = useState<string[]>(() => [...(cfg.extra || [])]);
  const [exclude, setExclude] = useState(() => cfg.exclude.join(', '));
  const [newName, setNewName] = useState('');
  const [who, setWho] = useState<{ prep: string[]; count: string[]; countAt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const schedule = cfg.schedule || [];

  const save = async () => {
    const ex = exclude.split(',').map(s => s.trim()).filter(Boolean);
    setBusy('save');
    try {
      const r = await call<{ schedule?: string[]; extra?: string[] }>('saveStaff', { off, extra, exclude: ex });
      setCfg({ off, extra, exclude: ex, ...(r?.schedule ? { schedule: r.schedule, extra: r.extra || [] } : {}) });
      if (r?.schedule) setExtra(r.extra || []);
      toast('Сохранено ✅'); haptic('success');
    } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };
  const setStatus = async (name: string, st: string) => {
    const next = (cfg.statuses || {})[name] === st ? '' : st;
    try { const r = await call<{ statuses: Record<string, string> }>('setStatus', { name, status: next }); setCfg({ statuses: r.statuses }); patchMe({ statuses: r.statuses }); hapticSelect(); }
    catch (e) { toast(errMsg(e)); }
  };
  const setViewer = async (id: string, on: boolean) => {
    if (on && !(await confirmBox('Сделать админом? Он увидит отчёты закрытий, сможет ставить задачи и создавать события. Менять заготовки и закрывать смену не сможет.'))) return;
    setBusy('v' + id);
    try { const r = await call<{ viewers: string[] }>('setViewer', { id, on }); setCfg({ viewers: r.viewers }); haptic('success'); } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };
  const removeUser = async (id: string) => {
    if (!(await confirmBox('Отключить сотрудника от бота?'))) return;
    try { await call('removeUser', { id }); queryClient.setQueryData(qk.cfg, await call<Config>('config')); } catch (e) { toast(errMsg(e)); }
  };
  const checkWho = async () => {
    setBusy('who');
    try { setWho(await call('whoToday')); } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };

  const sts = cfg.statuses || {};
  const stNames = schedule.filter(n => (cfg.off || []).indexOf(n) < 0).concat(cfg.extra || []);
  return (
    <>
      <Card>
        <h2>Команда бара</h2>
        <p className="sub">Все из графика этого месяца попадают сюда сами. Новый человек в графике — появится тут, убрали из графика — пропадёт. Нажми на имя, чтобы выключить того, кто не работает в баре.</p>
        <div className="chips">
          {schedule.length ? schedule.map(n => (
            <button key={n} className={'chip' + (off.includes(n) ? '' : ' on')} onClick={() => setOff(l => (l.includes(n) ? l.filter(x => x !== n) : [...l, n]))}>{n}</button>
          )) : <p className="sub">В графике этого месяца никого не нашёл</p>}
        </div>
        <h3>Добавить вручную</h3>
        <p className="sub">Если человека нет в графике</p>
        {extra.map((n, k) => (
          <div className="user" key={n + k}>
            <Avatar name={n} />
            <div className="pname"><b>{n}</b><span>добавлен вручную</span></div>
            <button className="x" onClick={() => setExtra(l => l.filter((_, j) => j !== k))}>×</button>
          </div>
        ))}
        <div className="cl-row" style={{ marginTop: 8 }}>
          <input placeholder="Имя" value={newName} onChange={e => setNewName(e.target.value)} style={{ minWidth: 0, flex: 1, border: '1.5px solid transparent', background: 'var(--cream)', borderRadius: 10, padding: '10px 12px', outline: 'none' }} />
          <button className="tkbtn" style={{ padding: '10px 14px', flex: '0 0 auto' }} onClick={() => { const v = newName.trim(); if (!v) return; setExtra(l => [...l, v]); setNewName(''); }}>Добавить</button>
        </div>
        <h3>Статусы «не в баре»</h3>
        <textarea rows={3} value={exclude} onChange={e => setExclude(e.target.value)} />
        <button className="btn" disabled={busy === 'save'} onClick={save}>Сохранить</button>
      </Card>

      <Card>
        <h2>Статусы</h2>
        <p className="sub">Нажми на статус — сохраняется сразу. Цвет видно на главном экране</p>
        {stNames.map(n => (
          <div className="strow" key={n}>
            <b>{n}</b> <StBadge st={sts[n]} />
            <label style={{ float: 'right', fontSize: 13, color: 'var(--muted)' }}>🎂 <BirthdayInput name={n} value={(cfg.bdays || {})[n]} /></label>
            <div className="seg">
              {ST_LIST.map((st, k) => <button key={st} className={sts[n] === st ? 'on st' + k : ''} onClick={() => setStatus(n, st)}>{ST_LABEL[st]}</button>)}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <h2>Подключены к боту</h2>
        <p className="sub">«🛡 Админ» — работает как обычный сотрудник (отмечает заготовки, закрывает смену по графику, берёт замены), плюс видит историю закрытий и фото, ставит задачи и создаёт события. Список заготовок и команду менять не может</p>
        {cfg.users.length ? cfg.users.map(u => {
          const v = (cfg.viewers || []).indexOf(u.id) >= 0;
          const mismatch = schedule.length > 0 && !schedule.some(n => n.toLowerCase().trim() === String(u.name).toLowerCase().trim());
          return (
            <div className="user" key={u.id}>
              <Avatar name={u.name} />
              <div className="pname"><b>{u.name}</b><span>{v ? '🛡 админ: отчёты, задачи, события' : 'сотрудник'}{mismatch ? ' · ⚠️ имя не как в графике — бот не нашёл однозначную строку, поправь вручную' : ''}</span></div>
              <button className="tkbtn" disabled={busy === 'v' + u.id} style={v ? { background: 'var(--forest)', color: 'var(--cream)' } : undefined} onClick={() => setViewer(u.id, !v)}>🛡 Админ</button>
              <button className="x" onClick={() => removeUser(u.id)}>×</button>
            </div>
          );
        }) : <p className="sub">Пока никто не зарегистрировался. Скинь команде ссылку на бота.</p>}
      </Card>

      <Card>
        <h2>Проверка графика</h2>
        <p className="sub">Кого бот отметит сегодня. Поменял график — нажми «Обновить график» на вкладке «Сегодня»</p>
        {who && <><h3>Заготовки 14:00–15:30</h3>{badges(who.prep)}<h3>Подсчёт в {who.countAt}</h3>{badges(who.count)}</>}
        <button className="btn soft" disabled={busy === 'who'} onClick={checkWho}>{busy === 'who' ? 'Смотрю график…' : 'Проверить сегодня'}</button>
      </Card>
    </>
  );
}

/** День рождения «дд.мм»: можно набирать только цифры — точка ставится сама (2210 → 22.10). Сохраняется при выходе из поля */
function BirthdayInput({ name, value }: { name: string; value?: string }) {
  const shown = (v?: string) => (v ? v.slice(3) + '.' + v.slice(0, 2) : '');   // 'MM-DD' → 'DD.MM'
  const [text, setText] = useState(shown(value));
  const save = async () => {
    const dg = text.replace(/\D/g, '');
    let dd = 0, mm = 0;
    if (dg.length === 4) { dd = +dg.slice(0, 2); mm = +dg.slice(2); }
    else if (dg.length === 3) { dd = +dg.slice(0, 1); mm = +dg.slice(1); }
    if (dg && !(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12)) return toast('Введи день и месяц, например 2210 → 22.10');
    if (dg) setText(String(dd).padStart(2, '0') + '.' + String(mm).padStart(2, '0'));
    const date = dg ? String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0') : '';
    if (date === (value || '')) return;
    try {
      const r = await call<{ bdays: Record<string, string> }>('setBirthday', { name, date });
      setCfg({ bdays: r.bdays });
      queryClient.setQueryData<HomeData>(qk.home, h => (h ? { ...h, bdays: r.bdays } : h));
      toast(date ? 'День рождения сохранён 🎂' : 'Удалено');
    } catch (e) { toast(errMsg(e)); }
  };
  return (
    <input className="bdin" placeholder="дд.мм" inputMode="numeric" maxLength={5} value={text} onBlur={save}
      onChange={e => { const dg = e.target.value.replace(/\D/g, '').slice(0, 4); setText(dg.length > 2 ? dg.slice(0, 2) + '.' + dg.slice(2) : dg); }} />
  );
}
