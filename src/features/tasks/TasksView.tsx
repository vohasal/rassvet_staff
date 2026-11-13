import { useState } from 'react';
import { create } from 'zustand';
import { getMe, invalidate, patchMe, qk, refreshMe, useTasks } from '../../api/queries';
import type { Audience, CreatedTask, Task, TasksData } from '../../api/types';
import { AudiencePicker, emptyAudience } from '../../components/AudiencePicker';
import { Sheet } from '../../components/overlays';
import { PhotoGrid, RemotePhoto, uploadPhotos, type Photo } from '../../components/photos';
import { Await, Card } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { confirmBox, haptic } from '../../lib/telegram';
import { closeSheet, openSheet, toast } from '../../store/ui';

// черновик новой задачи живёт между вкладками
const useForm = create<{ text: string; due: string; to: Audience }>(() => ({ text: '', due: '', to: emptyAudience() }));

export default function TasksView() {
  const q = useTasks();
  return <Await q={q}>{d => <Tasks d={d} />}</Await>;
}

/** Задача выполнена — счётчик на вкладке уменьшить и список перечитать */
const afterDone = () => {
  invalidate(qk.tasks);
  patchMe({ openTasks: Math.max(0, (getMe().openTasks || 1) - 1) });
};

function Tasks({ d }: { d: TasksData }) {
  const open = d.mine.filter(t => !t.doneMe), done = d.mine.filter(t => t.doneMe);
  const markDone = async (t: Task) => {
    if (t.needPhoto) return openSheet(<TaskDoneSheet t={t} />);
    if (!(await confirmBox('Отметить задачу выполненной? Тот, кто поставил, получит уведомление.'))) return;
    try { await call('taskDone', { id: t.id }); haptic('success'); toast('Молодец! ✅'); afterDone(); } catch (e) { toast(errMsg(e)); }
  };
  const row = (t: Task) => (
    <div key={t.id} className={'task' + (t.doneMe ? ' done' : '')}>
      <div className="box" onClick={t.doneMe ? undefined : () => markDone(t)}>✓</div>
      <div className="pname"><b>{t.text}</b><span>от {t.byName}{t.due ? ' · срок: ' + t.due : ''}</span></div>
    </div>
  );
  return (
    <>
      <Card>
        <h2>Мои задачи</h2>
        <p className="sub">{open.length ? 'Сделал — нажми на квадрат и приложи 2–5 фото результата' : 'Все задачи выполнены 🎉'}</p>
        {open.map(row)}
        {done.length > 0 && <><h3>Выполнено</h3>{done.slice(0, 10).map(row)}</>}
      </Card>
      {d.canCreate && <NewTask d={d} />}
      {d.canCreate && d.created.length > 0 && <Created list={d.created} />}
    </>
  );
}

function NewTask({ d }: { d: TasksData }) {
  const f = useForm();
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const text = f.text.trim(), due = f.due.trim();
    if (!text) return toast('Напиши, что нужно сделать');
    if (f.to.mode === 'status' && !f.to.statuses.length) return toast('Выбери статус');
    if (f.to.mode === 'people' && !f.to.ids.length) return toast('Выбери людей');
    setBusy(true);
    try {
      await call('taskAdd', { text, due, to: f.to });
      haptic('success'); toast('Задача отправлена ✅');
      useForm.setState({ text: '', due: '' });
      invalidate(qk.tasks); await refreshMe();
    } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Card>
      <h2>Поставить задачу</h2>
      <div className="form">
        <label>Что нужно сделать<textarea rows={3} placeholder="Например: протереть полки за кофемашиной" value={f.text} onChange={e => useForm.setState({ text: e.target.value })} /></label>
        <label>Срок (необязательно)<input placeholder="до пятницы, до 18:00…" value={f.due} onChange={e => useForm.setState({ due: e.target.value })} /></label>
        <label>Кому</label>
        <AudiencePicker f={f.to} d={d} onChange={to => useForm.setState({ to })} />
        <button className="btn" disabled={busy} onClick={add}>{busy ? 'Отправляю…' : 'Поставить задачу'}</button>
      </div>
    </Card>
  );
}

function Created({ list }: { list: CreatedTask[] }) {
  const del = async (id: string) => {
    if (!(await confirmBox('Удалить задачу?'))) return;
    try { await call('taskDel', { id }); invalidate(qk.tasks); } catch (e) { toast(errMsg(e)); }
  };
  return (
    <Card>
      <h2>Поставленные</h2>
      {list.map(t => (
        <div className="task" key={t.id}>
          <div className="pname">
            <b>{t.text}</b>
            <span>{t.to} · готово {t.doneCnt}/{t.total}{t.leftNames.length && t.leftNames.length <= 6 ? ' · ждём: ' + t.leftNames.join(', ') : ''}</span>
          </div>
          {(t.photos || []).length > 0 && <button className="tkbtn" onClick={() => openSheet(<TaskPhotosSheet t={t} />)}>📷 {t.photos!.reduce((a, g) => a + g.ids.length, 0)}</button>}
          <button className="x" onClick={() => del(t.id)}>×</button>
        </div>
      ))}
    </Card>
  );
}

// Выполнить задачу: 2–5 фото результата
const PH_MIN = 2, PH_MAX = 5;
function TaskDoneSheet({ t }: { t: Task }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const ok = photos.filter(p => p.id).length, loading = photos.some(p => p.loading);
  const send = async () => {
    if (loading) return toast('Подожди, фото загружаются…');
    const ids = photos.filter(p => p.id).map(p => p.id);
    if (ids.length < PH_MIN) return toast('Приложи минимум ' + PH_MIN + ' фото');
    setBusy(true);
    try { await call('taskDone', { id: t.id, photos: ids }); haptic('success'); toast('Молодец! ✅'); closeSheet(); afterDone(); }
    catch (e) { toast(errMsg(e)); setBusy(false); }
  };
  return (
    <Sheet>
      <h2>✅ Задача выполнена</h2>
      <p className="sub" style={{ marginTop: 4 }}>{t.text}</p>
      <p className="sub">Приложи фото результата — <b>минимум {PH_MIN}</b>, до {PH_MAX}. {t.byName} увидит их вместе с отметкой</p>
      <PhotoGrid photos={photos} max={PH_MAX} onRemove={i => setPhotos(l => l.filter((_, k) => k !== i))} onAdd={files => uploadPhotos(files, 'taskPhoto', setPhotos)} />
      <button className={'btn' + (ok < PH_MIN || loading ? ' locked' : '')} disabled={busy} onClick={send}>
        {busy ? 'Отправляю…' : loading ? '⏳ Загружаю фото…' : ok < PH_MIN ? '🔒 Добавь ещё ' + (PH_MIN - ok) + ' фото' : 'Отметить выполненной'}
      </button>
      <button className="btn soft" onClick={closeSheet}>Отмена</button>
    </Sheet>
  );
}

// Фото к выполненной задаче (видит тот, кто поставил, и админ)
function TaskPhotosSheet({ t }: { t: CreatedTask }) {
  return (
    <Sheet>
      <h2>📷 Фото к задаче</h2>
      <p className="sub" style={{ marginTop: 4 }}>{t.text}</p>
      {(t.photos || []).map(g => (
        <div key={g.name}>
          <h3>{g.name}</h3>
          <div className="photos">{g.ids.map(id => <RemotePhoto key={id} id={id} />)}</div>
        </div>
      ))}
      <button className="btn soft" onClick={closeSheet}>Закрыть</button>
    </Sheet>
  );
}
