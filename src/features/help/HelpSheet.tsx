import { useEffect, useState } from 'react';
import { Sheet } from '../../components/overlays';
import { call, errMsg } from '../../lib/api';
import { haptic } from '../../lib/telegram';
import { closeSheet, toast } from '../../store/ui';
import { HELP } from './helpContent';

type Ep = { n: number; t: string; ready?: boolean };

export function HelpSheet() {
  // видео-обучение: список серий, по нажатию бот присылает видео в личку
  const [eps, setEps] = useState<Ep[] | null | 'err'>(null);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => { call<{ eps?: Ep[] }>('train').then(r => setEps(r.eps || []), () => setEps('err')); }, []);

  const send = async (n: number) => {
    setBusy(n);
    try { await call('trainSend', { n }); haptic('success'); toast('Видео отправлено в чат с ботом 🎬'); } catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };

  return (
    <Sheet>
      <h2>Как пользоваться ботом</h2>
      <div className="card" style={{ padding: '12px 14px', marginTop: 10 }}>
        <h3 style={{ margin: '0 0 4px' }}>🎬 Видео-обучение</h3>
        <p className="sub" style={{ margin: '0 0 6px' }}>Нажми на серию — видео придёт в чат с ботом</p>
        <div className="chips">
          {eps === null ? <span className="sub">Загружаю…</span>
            : eps === 'err' ? <span className="sub">Не удалось загрузить</span>
            : !eps.length ? <span className="sub">Видео пока нет</span>
            : eps.map(e => (
              <button key={e.n} className="chip" disabled={!e.ready || busy === e.n} style={e.ready ? undefined : { opacity: 0.5 }} onClick={() => send(e.n)}>
                ▶ {e.n}. {e.t}
              </button>
            ))}
        </div>
      </div>
      <p className="sub" style={{ marginTop: 10 }}>Нажми на раздел, чтобы открыть</p>
      <div className="card help" style={{ padding: '2px 14px' }}>
        {HELP.map(([ic, t, items]) => (
          <details key={t}>
            <summary><span className="ic">{ic}</span>{t}</summary>
            <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </details>
        ))}
      </div>
      <button className="btn soft" onClick={closeSheet}>Закрыть</button>
    </Sheet>
  );
}
