// Карточки «Генуборка» и «Передача склада» (показываются на «Сегодня» и «Заказ»)
import { useState } from 'react';
import { refreshMe } from '../../api/queries';
import type { Me } from '../../api/types';
import { Sheet } from '../../components/overlays';
import { PhotoGrid, uploadPhotos, type Photo } from '../../components/photos';
import { Card } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { tmTash } from '../../lib/format';
import { confirmBox, haptic } from '../../lib/telegram';
import { closeSheet, openSheet, toast } from '../../store/ui';

// ===== ГЕНУБОРКА (пн–ср) =====
export function GuCard({ me }: { me: Me }) {
  const g = me.gu; if (!g) return null;
  return (
    <Card>
      <h2>🧹 Генуборка</h2>
      <p className="sub">{g.shifts.length > 1 ? 'Твои смены: ' : 'Твоя смена: '}<b>{g.shifts.join('; ')}</b></p>
      {g.done
        ? <div className="status"><span className="big">✅</span>Отмечено — спасибо!</div>
        : <>
          <p className="sub">Зону уборки посмотри в сообщении в группе. Убрал(а) — нажми кнопку и загрузи фото: их получат администраторы. Отметить можно до конца среды.</p>
          <button className="btn" onClick={() => openSheet(<GuDoneSheet mon={g.mon} />)}>✅ Выполнил</button>
        </>}
    </Card>
  );
}

function GuDoneSheet({ mon }: { mon: string }) {
  const MAX = 5;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const loading = photos.some(p => p.loading), n = photos.filter(p => p.id).length;
  const send = async () => {
    if (loading) return toast('Подожди, фото загружаются…');
    const ids = photos.filter(p => p.id).map(p => p.id);
    if (!ids.length && !(await confirmBox('Фото уже выложил(а) в группу?'))) return;
    setBusy(true);
    try { await call('guDone', { mon, photos: ids }); haptic('success'); toast('Спасибо! Генуборка отмечена ✅'); closeSheet(); await refreshMe(); }
    catch (e) { toast(errMsg(e)); setBusy(false); }
  };
  return (
    <Sheet>
      <h2>🧹 Генуборка выполнена</h2>
      <p className="sub" style={{ marginTop: 4 }}>Загрузи фото своей зоны (до {MAX}) — их получат администраторы. Если уже выложил(а) фото в группу — просто нажми кнопку.</p>
      <PhotoGrid photos={photos} max={MAX} onRemove={i => setPhotos(l => l.filter((_, k) => k !== i))} onAdd={files => uploadPhotos(files, 'guPhoto', setPhotos)} />
      <button className="btn" disabled={busy} onClick={send}>{busy ? 'Отправляю…' : loading ? '⏳ Загружаю фото…' : n ? '✅ Выполнил · ' + n + ' фото' : '✅ Выполнил'}</button>
      <button className="btn soft" onClick={closeSheet}>Отмена</button>
    </Sheet>
  );
}

// ===== ПЕРЕДАЧА СКЛАДА: утро сдаёт по чек-листу, вечер принимает =====
export function SkCard({ me }: { me: Me }) {
  const [on, setOn] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const k = me.sk; if (!k) return null;
  const s = k.s, acc = s?.acc;

  const give = async () => {
    const miss = k.items.length - on.length;
    if (miss && !(await confirmBox(`Не отмечено пунктов: ${miss}. Сдать склад с пометкой «не в порядке»?`))) return;
    setBusy(true);
    try { await call('skGive', { checks: on, note }); haptic('success'); toast('Склад сдан — вечерняя смена получила сообщение ✅'); await refreshMe(); }
    catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };
  const accept = async () => {
    setBusy(true);
    try { toast((await call<{ msg: string }>('skAcc', { ok: true })).msg); haptic('success'); await refreshMe(); } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };

  const sum = s ? (
    <p className="sub">
      Сдал(а) <b>{s.by}</b> в {tmTash(s.at)} · {s.miss.length ? '⚠️ не в порядке: ' + s.miss.join(', ') : '✅ все пункты в порядке'}
      {s.note ? <><br />💬 {s.note}</> : null}
    </p>
  ) : null;

  if (k.role === 'give' && !s) return (
    <Card>
      <h2>📦 Передача склада</h2>
      <p className="sub">Перед уходом пройди чек-лист уборки склада и сдай склад вечерней смене{k.take.length ? ' (' + k.take.join(', ') + ')' : ''}. Что не в порядке — не отмечай.</p>
      {k.items.map((it, i) => (
        <div key={i} className={'check' + (on.includes(i) ? ' on' : '')} onClick={() => setOn(l => (l.includes(i) ? l.filter(x => x !== i) : [...l, i]))}>
          <div className="box">✓</div>
          <div><b>{it.t}</b>{it.d ? <span className="skd">{it.d}</span> : null}</div>
        </div>
      ))}
      <div className="form"><textarea rows={2} placeholder="Комментарий для вечерней смены (необязательно)" value={note} onChange={e => setNote(e.target.value)} /></div>
      <button className="btn" disabled={busy} onClick={give}>{busy ? 'Отправляю…' : '📦 Сдать склад'}</button>
    </Card>
  );
  if (k.role === 'take' && !s) return (
    <Card><h2>📦 Передача склада</h2><p className="sub">Утренняя смена{k.give.length ? ' (' + k.give.join(', ') + ')' : ''} ещё не сдала склад. Как сдаст — придёт сообщение.</p></Card>
  );
  if (k.role === 'take' && !acc) return (
    <Card>
      <h2>📦 Приём склада</h2>{sum}<p className="sub">Проверь склад и подтверди.</p>
      <button className="btn" disabled={busy} onClick={accept}>✅ Принял(а)</button>
      <button className="btn soft" onClick={() => openSheet(<SkBadSheet />)}>⚠️ Есть замечания</button>
    </Card>
  );
  return (
    <Card>
      <h2>📦 Передача склада</h2>{sum}
      {acc
        ? <div className="status" style={acc.note ? { background: 'var(--warm-soft)', color: 'var(--warm)' } : undefined}>
          <span className="big">{acc.note ? '⚠️' : '✅'}</span>Принял(а) {acc.by} в {tmTash(acc.at)}{acc.note ? ': ' + acc.note : ''}
        </div>
        : s ? <p className="sub">Вечерняя смена ещё не подтвердила.</p> : null}
    </Card>
  );
}

function SkBadSheet() {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const t = note.trim(); if (!t) return toast('Напиши, что не так');
    setBusy(true);
    try { toast((await call<{ msg: string }>('skAcc', { ok: false, note: t })).msg); closeSheet(); await refreshMe(); } catch (e) { toast(errMsg(e)); setBusy(false); }
  };
  return (
    <Sheet>
      <h2>⚠️ Что не в порядке?</h2>
      <p className="sub" style={{ marginTop: 4 }}>Передам управляющему и утренней смене.</p>
      <div className="form"><textarea rows={3} placeholder="Например: морозильник грязный, коробки в проходе" value={note} onChange={e => setNote(e.target.value)} /></div>
      <button className="btn" disabled={busy} onClick={send}>Отправить</button>
      <button className="btn soft" onClick={closeSheet}>Отмена</button>
    </Sheet>
  );
}

