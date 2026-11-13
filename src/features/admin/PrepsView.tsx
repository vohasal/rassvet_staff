// Админ: список заготовок (нормы, техкарты, сроки) и чек-лист закрытия
import { useEffect, useRef, useState } from 'react';
import { qk, queryClient, refreshMe, useCfg, useTk } from '../../api/queries';
import type { CfgPrep, Config, TechCard } from '../../api/types';
import { Await, Card, Dock } from '../../components/ui';
import { call, errMsg } from '../../lib/api';
import { norm2 } from '../../lib/format';
import { haptic } from '../../lib/telegram';
import { lowDef } from '../../lib/units';
import { toast } from '../../store/ui';

const ND_WD = ['', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export default function PrepsView() {
  const cfg = useCfg(), tk = useTk();
  // техкарты не загрузились — редактор всё равно работает, просто без списка рецептов
  const cards = tk.data || (tk.isError ? [] : undefined);
  return <Await q={{ ...cfg, data: cfg.data && cards ? { cfg: cfg.data, cards } : undefined, isPending: cfg.isPending || !cards }}>{d => <Preps cfg={d.cfg} cards={d.cards} />}</Await>;
}

/** Срок хранения из техкарты в днях («7 суток» → 7) — серая подсказка */
function tkShelf(cards: TechCard[], tk: string | null | undefined) {
  const c = cards.find(x => x.id === tk), m = c && String(c.shelf || '').match(/(\d+)\s*(сут|дн|день|дней)/i);
  return m ? m[1] : '';
}

function Preps({ cfg, cards }: { cfg: Config; cards: TechCard[] }) {
  // техкарта не выбрана — угадываем по названию
  const [preps, setPreps] = useState<CfgPrep[]>(() => {
    const stem = (w: string) => norm2(w).slice(0, 4);
    const guess = (name: string) => {
      const ws = norm2(name).split(' ').filter(w => w.length > 3).map(stem);
      const c = cards.filter(c => !c.hidden).find(c => norm2(c.title).split(' ').some(w => ws.indexOf(stem(w)) >= 0));
      return c ? c.id : '';
    };
    return cfg.preps.map(p => ({ ...p, nd: { ...(p.nd || {}) }, tk: p.tk == null ? guess(p.name) : p.tk }));
  });
  const [cl, setCl] = useState<string[]>(() => [...(cfg.checklist || [])]);
  const [busy, setBusy] = useState<string | null>(null);
  const focus = useRef<string | null>(null);
  useEffect(() => {
    if (!focus.current) return;
    const l = document.querySelectorAll<HTMLInputElement>(focus.current);
    focus.current = null;
    if (l.length) { l[l.length - 1].focus(); l[l.length - 1].scrollIntoView({ block: 'center' }); }
  });

  const upd = (i: number, patch: Partial<CfgPrep>) => setPreps(l => l.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const setCfg = (patch: Partial<Config>) => queryClient.setQueryData<Config>(qk.cfg, c => (c ? { ...c, ...patch } : c));

  const saveChecklist = async () => {
    setBusy('cl');
    try { const r = await call<{ checklist: string[] }>('saveChecklist', { items: cl }); setCfg({ checklist: r.checklist }); setCl(r.checklist); await refreshMe(); toast('Чек-лист сохранён ✅'); haptic('success'); }
    catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };
  const savePreps = async () => {
    setBusy('preps');
    try { const r = await call<{ preps: CfgPrep[] }>('savePreps', { preps }); setCfg({ preps: r.preps }); setPreps(r.preps); await refreshMe(); toast('Сохранено ✅'); haptic('success'); }
    catch (e) { toast(errMsg(e)); }
    setBusy(null);
  };

  const str = (v: unknown) => (v == null ? '' : String(v));
  return (
    <>
      <Card>
        <h2>Список заготовок</h2>
        <p className="sub">Минимум — ниже этого нужно варить. Норма — до скольки варить. «Норма по дням» — своя норма на загруженные или тихие дни; цифры подсказывает бот в понедельник. Техкарта — рецепт из таблицы, выход для пересчёта берётся из строки «Выход» в техкарте. Срок хранения — для напоминаний в «Холодильнике»; пусто — берётся из техкарты (серая цифра).</p>
        {preps.map((p, i) => {
          const nd = p.nd || {}, ndKeys = Object.keys(nd).filter(w => str(nd[w]) !== '');
          return (
            <div className="edit" key={i}>
              <div className="top">
                <input data-f="name" value={str(p.name)} placeholder="Название, например «Сироп ваниль»" onChange={e => upd(i, { name: e.target.value })} />
                <button className="x" title="Удалить" onClick={() => setPreps(l => l.filter((_, k) => k !== i))}>×</button>
              </div>
              <div className="grid3">
                <label>Единица<input value={str(p.unit)} placeholder="л" onChange={e => upd(i, { unit: e.target.value })} /></label>
                <label>Минимум<input inputMode="decimal" value={str(p.min)} placeholder="0" onChange={e => upd(i, { min: e.target.value })} /></label>
                <label>Норма<input inputMode="decimal" value={str(p.norm)} placeholder="0" onChange={e => upd(i, { norm: e.target.value })} /></label>
              </div>
              <details className="nd" open={ndKeys.length > 0 || undefined}>
                <summary>Норма по дням{ndKeys.length ? ' · ' + ndKeys.map(w => ND_WD[+w] + ' ' + nd[w]).join(', ') : ''}</summary>
                <p className="sub" style={{ margin: '4px 0 0' }}>Пусто — обычная норма. День — это день, когда варят.</p>
                <div className="grid3 nd7">
                  {[1, 2, 3, 4, 5, 6, 7].map(w => (
                    <label key={w}>{ND_WD[w]}<input inputMode="decimal" value={str(nd[w])} placeholder={str(p.norm)} onChange={e => upd(i, { nd: { ...nd, [w]: e.target.value } })} /></label>
                  ))}
                </div>
              </details>
              <div className="grid3" style={{ gridTemplateColumns: '1fr' }}>
                <label>Техкарта
                  <select value={str(p.tk)} onChange={e => upd(i, { tk: e.target.value })}>
                    <option value="">— нет —</option>
                    {cards.filter(c => !c.hidden || p.tk === c.id).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label>{p.frz ? 'Хранится после разморозки, дней' : 'Срок хранения, дней'}<input inputMode="numeric" value={str(p.shelf)} placeholder={tkShelf(cards, p.tk) || '—'} onChange={e => upd(i, { shelf: e.target.value })} /></label>
                {p.frz ? <label>В морозилке, дней<input inputMode="numeric" value={str(p.frzDays)} placeholder="30" onChange={e => upd(i, { frzDays: e.target.value })} /></label> : <span />}
              </div>
              <div className="grid3" style={{ gridTemplateColumns: '1fr' }}>
                <label>Почти пусто, если меньше ({p.unit || 'ед.'}) — тогда бот пишет «варить» как с нуля
                  <input inputMode="decimal" value={p.low != null ? String(p.low).replace('.', ',') : ''} placeholder={lowDef(p.unit)} onChange={e => upd(i, { low: e.target.value })} />
                </label>
              </div>
              <label className="switch"><input type="checkbox" checked={!!p.frz} onChange={e => upd(i, { frz: e.target.checked })} /> ❄️ Замораживаем (часть кладут в морозилку)</label>
            </div>
          );
        })}
        <button className="btn soft" onClick={() => { setPreps(l => [...l, { name: '', unit: '', min: '', norm: '', tk: '', yield: '' }]); focus.current = '.edit input[data-f="name"]'; }}>+ Добавить заготовку</button>
      </Card>
      <Card>
        <h2>Чек-лист закрытия</h2>
        <p className="sub">Пункты, которые отмечают на закрытии смены</p>
        <div>
          {cl.map((t, k) => (
            <div className="cl-row edit" style={{ padding: 8, marginBottom: 8 }} key={k}>
              <input data-cl value={t} placeholder="Например: почистить кофемашину" onChange={e => setCl(l => l.map((x, j) => (j === k ? e.target.value : x)))} />
              <button className="x" onClick={() => setCl(l => l.filter((_, j) => j !== k))}>×</button>
            </div>
          ))}
        </div>
        <button className="btn soft" onClick={() => { setCl(l => [...l, '']); focus.current = '[data-cl]'; }}>+ Добавить пункт</button>
        <button className="btn" disabled={busy === 'cl'} onClick={saveChecklist}>Сохранить чек-лист</button>
      </Card>
      <Dock><button className="btn" disabled={busy === 'preps'} onClick={savePreps}>Сохранить заготовки</button></Dock>
    </>
  );
}
