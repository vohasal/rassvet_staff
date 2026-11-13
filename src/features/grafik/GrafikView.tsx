// График: сотрудник отмечает желаемые выходные, админ видит сбор и составленный график
import { useState } from 'react';
import { create } from 'zustand';
import { invalidate, qk, queryClient, useGrafik } from '../../api/queries';
import type { GrafikData, GrDay } from '../../api/types';
import { Await, Card, Empty } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { addD, dayUTC, dmy } from '../../lib/format';
import { confirmBox, haptic, hapticSelect, openLink } from '../../lib/telegram';
import { toast } from '../../store/ui';

// Выбор живёт между вкладками, пока не сохранили
interface Vac { t: '' | 'o' | 'b'; from: string; to: string }
const useGr = create<{ sel: string[] | null; note: string | null; z: string | null; vac: Vac | null }>(() => ({ sel: null, note: null, z: null, vac: null }));

export default function GrafikView() {
  const q = useGrafik();
  return <Await q={q}>{d => <Grafik d={d} />}</Await>;
}

const range = (a: string, b: string) => { const out: string[] = []; for (let x = a; x <= b && out.length < 40; x = addD(x, 1)) out.push(x); return out; };
const places = (n: number) => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'место' : [2, 3, 4].indexOf(n % 10) >= 0 && (n % 100 < 12 || n % 100 > 14) ? 'места' : 'мест');
const wdL = (s: string) => dayUTC(s, { weekday: 'long' });
const dnL = (s: string) => dayUTC(s, { day: 'numeric', month: 'long' });
const dt = (ts: number) => new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

function Grafik({ d }: { d: GrafikData }) {
  const [busy, setBusy] = useState<string | null>(null);
  /** Запрос к боту; ответ — новый график целиком */
  const act = async (key: string | null, action: string, payload: unknown, ok?: string) => {
    if (key) setBusy(key);
    try {
      const r = await call<GrafikData>(action, payload);
      queryClient.setQueryData(qk.grafik, r);
      useGr.setState({ sel: null });
      if (r.msg) toast(r.msg); else if (ok) toast(ok);
      haptic('success');
      setBusy(null);
      return r;
    } catch (e) { toast(errMsg(e)); setBusy(null); return null; }
  };
  const r = d.req;
  const showWish = !!(r && r.open && (d.inList || !d.isAdmin));
  return (
    <>
      {showWish ? <Wishes d={d} act={act} busy={busy} />
        : r && !r.open && !d.isAdmin ? <Empty icon="🗓" title="Сбор выходных закончен" text={`Пожелания на ${dmy(r.from)}–${dmy(r.to)} собраны — скоро будет график`} />
        : !d.isAdmin ? <Empty icon="🗓" title="Сейчас сбор выходных не идёт" text="Когда админ начнёт составлять график, бот пришлёт сообщение — отметишь дни здесь или кнопками в чате" />
        : null}
      {d.isAdmin && <Admin d={d} act={act} busy={busy} />}
    </>
  );
}

type Act = (key: string | null, action: string, payload: unknown, ok?: string) => Promise<GrafikData | null>;

// ===== сотрудник: желаемые выходные, заявление, отпуск/больничный =====
function Wishes({ d, act, busy }: { d: GrafikData; act: Act; busy: string | null }) {
  const st = useGr();
  const r = d.req!, mine = d.mine, days = d.days || [];
  const sel = new Set(st.sel ?? mine?.d ?? []);
  const note = st.note ?? mine?.note ?? '';
  const [reason, setReason] = useState('');
  const info = (x: string): GrDay => days.find(y => y.date === x) || { date: x, free: true, left: null, z: '' };

  const toggleDay = (x: string) => {
    if (!sel.has(x) && sel.size + days.filter(y => y.z === 'ok' || y.z === 'wait').length >= (d.maxOff || 3)) {
      return toast(d.maxOff === 2 ? 'Выходной можно взять только в сб или вс' : 'Можно не больше 3 выходных в неделю');
    }
    const n = new Set(sel); if (n.has(x)) n.delete(x); else n.add(x);
    useGr.setState({ sel: [...n] });
    hapticSelect();
  };
  const save = () => { const t = note.trim(); useGr.setState({ note: null }); act('save', 'grWish', { d: [...sel], note: t }, 'Записал 🌴 Спасибо!'); };
  const sendZ = async () => {
    if (!reason.trim()) return toast('Напиши причину');
    const res = await act('z', 'grZ', { date: st.z, reason: reason.trim() });
    if (res) { useGr.setState({ z: null }); setReason(''); }
  };
  const vac = st.vac;
  const setVac = (p: Partial<Vac>) => useGr.setState(s => ({ vac: s.vac ? { ...s.vac, ...p } : s.vac }));
  const sendVac = async () => {
    if (!vac) return;
    if (!vac.t) return toast('Выбери: отпуск или больничный');
    if (!vac.from) return toast('Выбери, с какого числа');
    const res = await act('vac', 'grVac', { t: vac.t, from: vac.from, to: vac.to || vac.from });
    if (res) useGr.setState({ vac: null });
  };

  // 🌴 мой выходной · 🔒 мест нет (можно заявление) · ⏳ заявление ждёт · ✅ заявление одобрено
  const rows = range(r.from, r.to).filter(x => !d.maxOff || d.maxOff >= 3 || days.some(y => y.date === x)).map(x => {
    const i = info(x), my = sel.has(x), left = i.left == null ? null : Math.max(0, i.left - (my ? 1 : 0));
    let btn;
    if (!my && (i.z === 'ok' || i.z === 'wait')) btn = <button className={'grbtn ' + (i.z === 'ok' ? 'on' : 'busy')} onClick={() => toast(i.z === 'ok' ? 'Выходной по заявлению одобрен ✅' : 'Заявление ждёт решения админа ⏳')}>{i.z === 'ok' ? '✅ Одобрено' : '⏳ Заявление'}</button>;
    else if (!my && !i.free) btn = <button className="grbtn busy" onClick={() => useGr.setState({ z: x })}>🔒 Занято</button>;
    else btn = <button className={'grbtn' + (my ? ' on' : '')} onClick={() => toggleDay(x)}>{my ? '🌴 Выходной' : 'Выходной'}</button>;
    const sub = left == null ? '' : !my && !i.free ? 'мест нет — можно заявление' : left ? 'ещё можно: ' + places(left) : 'мест больше нет';
    return (
      <div key={x} className={'grrow' + (my ? ' on' : '')}>
        <div className="grday"><b>{wdL(x)}</b><span>{dnL(x)}{sub ? ' · ' + sub : ''}</span></div>{btn}
      </div>
    );
  });

  return (
    <>
      <Card>
        <h2>🗓 Желаемые выходные</h2>
        <p className="sub">
          График на {dmy(r.from)}–{dmy(r.to)}. {d.maxOff === 2 ? 'Обычно ты выходишь в субботу и воскресенье. Если нужен выходной — отметь один или оба дня' : 'Отметь дни, когда хочешь отдыхать'}, до <b>{r.dlText}</b> — бот постарается учесть. В один день могут отдыхать не все: если мест нет (🔒), можно подать заявление
        </p>
        <div className="grlist2">{rows}</div>
        <div className="form">
          <label>Комментарий для админа (необязательно)
            <textarea rows={2} maxLength={300} placeholder="Например: в пятницу могу только с 16:00" value={note} onChange={e => useGr.setState({ note: e.target.value })} />
          </label>
        </div>
        <button className="btn" disabled={busy === 'save'} onClick={save}>{mine?.done ? 'Сохранить изменения' : 'Сохранить'}</button>
        {mine?.done && <p className="sub" style={{ marginTop: 10 }}>✅ Записано: {mine.d.length ? mine.d.map(dmy).join(', ') : 'без пожеланий'}</p>}
      </Card>
      {st.z && (
        <Card>
          <h2>📝 Заявление на выходной</h2>
          <p className="sub">{dayUTC(st.z, { weekday: 'short', day: 'numeric', month: 'short' })} уже занят — в один день могут отдыхать не все, иначе некому работать. Если очень нужно — напиши причину, админ решит и бот пришлёт ответ</p>
          <div className="form"><textarea rows={3} maxLength={300} placeholder="Например: запись к врачу, экзамен" value={reason} onChange={e => setReason(e.target.value)} /></div>
          <div className="two">
            <button className="btn" disabled={busy === 'z'} onClick={sendZ}>Отправить админу</button>
            <button className="btn soft" onClick={() => useGr.setState({ z: null })}>Отмена</button>
          </div>
        </Card>
      )}
      <Card>
        {vac ? <>
          <h2>🤒 Отпуск / больничный</h2>
          <p className="sub">Выбери, что и с какого по какое число. Админ подтвердит — бот впишет в график и не поставит тебя на смены</p>
          <div className="two">
            <button className={'grbtn' + (vac.t === 'o' ? ' on' : '')} onClick={() => setVac({ t: 'o' })}>🏖 Отпуск</button>
            <button className={'grbtn' + (vac.t === 'b' ? ' on' : '')} onClick={() => setVac({ t: 'b' })}>🤒 Больничный</button>
          </div>
          <div className="form two">
            <label>С<input type="date" value={vac.from} onChange={e => setVac({ from: e.target.value })} /></label>
            <label>По<input type="date" value={vac.to} onChange={e => setVac({ to: e.target.value })} /></label>
          </div>
          <div className="two">
            <button className="btn" disabled={busy === 'vac'} onClick={sendVac}>Отправить админу</button>
            <button className="btn soft" onClick={() => useGr.setState({ vac: null })}>Отмена</button>
          </div>
        </> : <button className="btn soft" onClick={() => useGr.setState({ vac: { t: '', from: '', to: '' } })}>🤒 Я в отпуске / на больничном</button>}
      </Card>
    </>
  );
}

// ===== админ: сбор по дням, составление, утверждение, рассылка =====
function Admin({ d, act, busy }: { d: GrafikData; act: Act; busy: string | null }) {
  const r = d.req, nx = d.next, dr = d.draft;
  const ask = (text: string, key: string, action: string, payload: unknown = {}, ok?: string) => async () => { if (await confirmBox(text)) act(key, action, payload, ok); };
  const approve = async () => {
    if (!(await confirmBox('Перенести смены из черновика в лист месяца?'))) return;
    const res = await act('approve', 'grApprove', {});
    if (res?.conflict && (await confirmBox('После черновика в листе месяца поменяли смены этого периода. Перенести черновик поверх? Ручные правки в этих днях пропадут'))) act(null, 'grApprove', { force: true });
  };
  const zl = (d.answers || []).flatMap(w => (w.z || []).map(z => `📝 ${w.name}, ${dmy(z.date)}: ${z.st === 'ok' ? '✅ одобрено' : z.st === 'no' ? '❌ отказано' : '⏳ ждёт решения'} — «${z.r}»`));
  const stText = dr ? ({ done: '✅ внесён в лист «' + dr.month + '»', new: 'ждёт решения', approved: '✅ утверждён — перенесён в лист «' + dr.month + '»', manual: '✍️ оставлен — правишь сам' } as Record<string, string>)[dr.status] || dr.status : '';

  return (
    <>
      {!d.canEdit && <p className="sub" style={{ margin: '0 0 8px' }}>👀 График — только просмотр: составляет и меняет админ</p>}
      {/* по дням — сколько выходных занято (из скольки можно) и кто взял */}
      {r ? (
        <Card>
          <h2>🗓 Выходные {dmy(r.from)}–{dmy(r.to)}</h2>
          <p className="sub">{r.open ? 'Сбор идёт до ' + r.dlText + ', потом бот сам составит график и внесёт в таблицу' : r.done ? 'Сбор закрыт тобой — бот график не пересоставляет' : 'Сбор закончен'}. Справа — сколько выходных взяли из скольки можно</p>
          <div className="grlist2">
            {(d.days || []).map(x => {
              const n = (x.names || []).length, full = x.cap != null && n >= x.cap;
              return (
                <div className="grrow" key={x.date}>
                  <div className="grday"><b>{wdL(x.date)}</b><span>{dnL(x.date)}{n ? ' · 🌴 ' + x.names!.join(', ') : ''}</span></div>
                  <span className={'grbtn' + (full ? ' on' : '')}>{n}{x.cap != null ? ' из ' + x.cap : ''}</span>
                </div>
              );
            })}
          </div>
          {(d.wait || []).length > 0 && <p className="sub" style={{ marginTop: 10 }}>Ещё не ответили: {d.wait!.join(', ')}</p>}
          {zl.length > 0 && <p className="sub" style={{ marginTop: 6 }}>Заявления:{zl.map((t, i) => <span key={i}><br />{t}</span>)}</p>}
          {r.open && !d.job && d.canEdit && <>
            <p className="sub" style={{ marginTop: 10 }}>Не хочешь ждать — составь по тем выходным, что уже отметили. Сбор не закроется: кто не ответил — 5/2, отмечать можно до {r.dlText}. Тогда бот сам пересоставит с новыми выходными, а раньше — нажми ещё раз</p>
            <button className="btn" disabled={busy === 'now'} onClick={ask('Составить график по уже отмеченным выходным? Сбор не закроется', 'now', 'grGenNow')}>
              {dr && dr.from === r.from && dr.status === 'done' ? '🔄 Пересоставить с новыми выходными' : '🧩 Составить график сейчас'}
            </button>
            <p className="sub" style={{ marginTop: 12 }}>График уже готов (ботом или руками в таблице)? Закрой сбор — тогда в {r.dlText} бот ничего не пересоставит</p>
            <button className="btn soft" disabled={busy === 'done'} onClick={ask('Закрыть сбор выходных? Отмечать больше нельзя, и в субботу бот график не пересоставит', 'done', 'grDone')}>✅ График готов, закрыть сбор</button>
          </>}
        </Card>
      ) : <Empty icon="🗓" title="Сбор выходных сейчас не идёт" text="Каждую пятницу в 12:00 бот сам открывает сбор на следующую неделю (до субботы 18:00), потом сам составляет график и вносит в таблицу" />}

      {/* начать сбор на следующую неделю раньше пятницы */}
      {nx && !nx.err && d.canEdit && (
        <Card>
          <h2>🚀 Сбор на {dmy(nx.from)}–{dmy(nx.to)}</h2>
          <p className="sub">{nx.ahead ? 'Заранее, на неделю вперёд' : 'Не ждать пятницы'}: бот сразу напишет команде, примет выходные до {nx.dlText}, напомнит и сам составит график. В пятницу второй сбор не откроется</p>
          <button className="btn" disabled={busy === 'next'} onClick={ask(`Начать сбор выходных на ${dmy(nx.from)}–${dmy(nx.to)}? Бот сразу напишет всей команде`, 'next', 'grStartNext')}>🗓 Открыть сбор на {dmy(nx.from)}–{dmy(nx.to)}</button>
        </Card>
      )}

      {/* составленный график */}
      {d.job ? (
        <Card>
          <h2>⏳ Составляю график…</h2>
          <p className="sub">Это займёт пару минут — пришлю в бот</p>
          <button className="btn soft" onClick={() => invalidate(qk.grafik)}>🔄 Обновить</button>
        </Card>
      ) : dr ? (
        <Card>
          <h2>🧩 График {dmy(dr.from)}–{dmy(dr.to)}</h2>
          <p className="sub">Лист «{dr.sheet}» · {stText}</p>
          {dr.wishes ? <p className="sub">🌴 Желаемые выходные: учтено {dr.wishOk} из {dr.wishes}</p> : null}
          {dr.notes.length > 0 && <p className="sub">{dr.notes.map((x, i) => <span key={i}>{i ? <br /> : null}🕖 {x}</span>)}</p>}
          {dr.issues.length
            ? <><h3>⚠️ Не сходится с правилами ({dr.issues.length})</h3><ul className="grlist">{dr.issues.map((x, i) => <li key={i}>{x}</li>)}</ul></>
            : <p className="sub">✅ Все правила соблюдены</p>}
          {(dr.urls || [{ sheet: dr.sheet, url: dr.url }]).map(u => <button key={u.url + u.sheet} className="btn soft" onClick={() => openLink(u.url)}>📄 Открыть «{u.sheet}»</button>)}
          {dr.status === 'new' && d.canEdit && (
            <div className="two">
              <button className="btn" disabled={busy === 'approve'} onClick={approve}>✅ Утвердить</button>
              <button className="btn soft" disabled={busy === 'manual'} onClick={() => act('manual', 'grManual', {})}>✍️ Поправлю сам</button>
            </div>
          )}
          {dr.status === 'done' && <>
            <p className="sub" style={{ marginTop: 10 }}>{dr.sent && dr.sent > 0 ? '📤 Команде разослан ' + dt(dr.sent) : '📤 ' + (dr.sendNote || '')}</p>
            {d.canEdit && (
              <div className="two">
                <button className="btn" disabled={busy === 'send'} onClick={ask('Разослать каждому его смены на эту неделю?', 'send', 'grSend')}>📤 {dr.sent && dr.sent > 0 ? 'Разослать ещё раз' : 'Разослать команде'}</button>
                <button className="btn soft" disabled={busy === 'regen'} onClick={ask('Пересоставить график? Уберу то, что вписал бот, и составлю заново. Клетки, которые ты правил руками, останутся', 'regen', 'grRegen')}>🔄 Пересоставить</button>
              </div>
            )}
          </>}
          {d.snap && d.canEdit && <>
            <p className="sub" style={{ marginTop: 10 }}>Не понравился новый вариант — можно вернуть график, составленный {dt(d.snap.at)}</p>
            <button className="btn soft" disabled={busy === 'restore'} onClick={ask(d.snap.ask || 'Вернуть предыдущий график?', 'restore', 'grRestore')}>↩️ Вернуть предыдущий график</button>
          </>}
        </Card>
      ) : null}
    </>
  );
}
