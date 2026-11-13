// Регламент: документы из Google Docs, поиск по тексту
import { useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { qk, queryClient, useMe, useRegs } from '../../api/queries';
import type { RegDoc } from '../../api/types';
import { Await, Card } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { toast } from '../../store/ui';

const useQ = create<{ q: string }>(() => ({ q: '' }));   // поиск не сбрасывается при переключении вкладок

export default function RegsView() {
  const query = useRegs();
  return <Await q={query}>{docs => <Regs docs={docs} />}</Await>;
}

function Regs({ docs }: { docs: RegDoc[] }) {
  const me = useMe();
  const q0 = useQ(s => s.q);
  const [busy, setBusy] = useState(false);
  const q = q0.trim().toLowerCase();
  const found = docs.filter(x => !q || (x.title + '\n' + x.text).toLowerCase().indexOf(q) >= 0);
  const refresh = async () => {
    setBusy(true);
    try { queryClient.setQueryData(qk.regs, (await call<{ docs: RegDoc[] }>('regs', { fresh: true })).docs); toast('Регламенты обновлены ✅'); }
    catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Card>
      <h2>📜 Регламент</h2>
      <p className="sub">Правила бара. Тексты берутся из Google-документов — если их поправят, здесь обновится само.</p>
      <div className="form"><input type="search" placeholder="🔍 Поиск по регламентам" value={q0} onChange={e => useQ.setState({ q: e.target.value })} /></div>
      {me.isAdmin && <button className="btn soft" style={{ margin: '8px 0 0', padding: 11 }} disabled={busy} onClick={refresh}>{busy ? 'Читаю документы…' : '🔄 Обновить из документов'}</button>}
      <div style={{ marginTop: 6 }}>
        {found.length ? found.map(x => (
          // при поиске документы раскрыты; key с q — чтобы open применился заново
          <details className="reg" key={x.title + (q ? ':q' : '')} open={!!q}>
            <summary>{x.title}</summary>
            <div className="rt">{x.err ? <p style={{ color: 'var(--danger)' }}>{x.err}</p> : <RegText text={x.text} q={q} />}</div>
          </details>
        )) : <p className="sub">Ничего не нашёл</p>}
      </div>
    </Card>
  );
}

/** Текст документа: «• пункт» → список, «1.2 Заголовок» → подзаголовок, остальное — абзацы. Найденное подсвечено */
function RegText({ text, q }: { text: string; q: string }) {
  const hl = (s: string): ReactNode => {
    if (!q) return s;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return s.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
  };
  return (
    <>
      {text.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => {
        if (/^[*•-]\s+/.test(l)) return <li key={i}>{hl(l.replace(/^[*•-]\s+/, ''))}</li>;
        if (l.length < 90 && /^(☐\s*)?\d+(\.\d+)*\.?\s+\S/.test(l) && !/[.;:]$/.test(l)) return <h3 key={i}>{hl(l)}</h3>;
        return <p key={i}>{hl(l)}</p>;
      })}
    </>
  );
}
