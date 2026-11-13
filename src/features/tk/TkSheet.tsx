import { useState } from 'react';
import { getTk } from '../../api/queries';
import type { Me, Prep, TechCard } from '../../api/types';
import { Sheet } from '../../components/overlays';
import { errMsg } from '../../lib/api';
import { q, toNum } from '../../lib/format';
import { conv, UNIT } from '../../lib/units';
import { closeSheet, openSheet, toast } from '../../store/ui';

/** Открыть техкарту заготовки, сразу пересчитанную на amount (из «Сегодня») */
export async function openTkForPrep(me: Me, pid: string, amount: number | '' | null) {
  const p = me.preps.find(x => x.id === pid);
  if (!p || !p.tk) return toast('Для этой заготовки техкарта не привязана');
  try {
    const c = (await getTk()).find(x => x.id === p.tk);
    if (!c) return toast('Техкарта не найдена в таблице');
    openTk(c, p, amount);
  } catch (e) { toast(errMsg(e)); }
}

export const openTk = (c: TechCard, prep?: Prep, amount?: number | '' | null) => openSheet(<TkSheet c={c} prep={prep} amount={amount} />);

// Во сколько раз размер k больше размера S — по первому ингредиенту, где заполнены оба
function sizeRatio(c: TechCard, k: number) {
  const j = c.ings.find(i => i.amounts[0] && i.amounts[k]);
  return j ? (j.amounts[k] as number) / (j.amounts[0] as number) : null;
}

type Mode = 'amount' | 'have' | 'base';

/**
 * Техкарта с пересчётом.
 * amount — «сколько сварить» (пересчёт всех ингредиентов); have — «сколько есть» одного или нескольких
 * ингредиентов (считаем, сколько получится, по самому ограничивающему); base — просто как в техкарте.
 */
function TkSheet({ c, prep, amount }: { c: TechCard; prep?: Prep; amount?: number | '' | null }) {
  // выход берём из строки «Выход» в техкарте (размер S или первый заполненный)
  const yi = c.yields ? c.yields.findIndex(y => y && y.n > 0) : -1;
  const yU = yi >= 0 ? (c.yields![yi]!.u || prep?.unit || '') : '';
  const yieldS = yi >= 0 ? c.yields![yi]!.n / (yi === 0 ? 1 : (sizeRatio(c, yi) ?? NaN)) : 0;
  // «сварить +1,6 л» из «Сегодня» переводим в единицы выхода
  let start: number | '' | null | undefined = amount;
  if (start != null && start !== '' && yieldS && prep) {
    const cv = conv(Number(start), prep.unit, yU);
    start = cv != null ? Math.round(cv * 100) / 100 : UNIT(prep.unit)[0] === UNIT(yU)[0] ? start : null;
  }
  // база для пересчёта — количество в размере S (или первом заполненном)
  const base = c.ings.map(i => {
    const k = i.amounts.findIndex(x => x != null && x > 0);
    return k < 0 ? null : { k, v: (i.amounts[k] as number) / (k === 0 ? 1 : sizeRatio(c, k) ?? 1) };
  });

  const [mode, setMode] = useState<Mode>(yieldS ? 'amount' : 'base');
  const [amt, setAmt] = useState<string>(String(start != null && start !== '' ? start : yieldS || ''));
  const [have, setHave] = useState<Record<number, number>>({});
  const [raw, setRaw] = useState<{ k: number | 'amt'; text: string } | null>(null);   // что человек вписал прямо сейчас

  // → значения ингредиентов, коэффициент и какой ингредиент ограничивает
  let factor: number | null = null, limit: number | null = null;
  if (mode === 'amount') factor = yieldS && Number(toNum(amt)) > 0 ? Number(toNum(amt)) / yieldS : null;
  if (mode === 'have') Object.keys(have).forEach(ks => {
    const k = +ks, b = base[k]; if (!b || !(have[k] > 0)) return;
    const f = have[k] / b.v; if (factor == null || f < factor) { factor = f; limit = k; }
  });
  const vals = mode === 'base' ? base.map(b => (b ? b.v : null)) : base.map(b => (factor == null || !b ? null : b.v * factor));
  const manyHave = Object.keys(have).length > 1;

  const info = mode === 'have'
    ? factor == null ? 'Впиши, сколько есть хотя бы одного ингредиента'
      : <>{manyHave && limit != null ? <>Ограничивает: <b>{c.ings[limit].name}</b><br /></> : null}
        {yieldS ? <>Получится ≈ <b>{q(factor * yieldS)} {yU}</b> ({q(factor)} × техкарта)</> : '≈ ' + q(factor) + ' × техкарта'}</>
    : mode === 'amount' ? (factor ? '≈ ' + q(factor) + ' × техкарта' : 'Впиши, сколько нужно') : 'Количество по техкарте';

  const amtShown = raw?.k === 'amt' ? raw.text : mode === 'have' ? (factor != null ? q(factor * yieldS).replace(',', '.') : '') : amt;

  const onAmt = (text: string) => { setRaw({ k: 'amt', text }); setMode('amount'); setHave({}); setAmt(text); };
  const onIng = (k: number, text: string) => {
    setRaw({ k, text });
    const v = toNum(text);
    const h: Record<number, number> = mode === 'have' ? { ...have } : {};
    if (v === '' || isNaN(v)) delete h[k]; else h[k] = v;
    setHave(h);
    setMode(Object.keys(h).length ? 'have' : yieldS ? 'amount' : 'base');
  };
  const reset = () => { setHave({}); setRaw(null); setMode(yieldS ? 'amount' : 'base'); };

  return (
    <Sheet>
      <h2>{c.title}</h2>
      <p className="sub" style={{ marginTop: 4 }}>📦 Выход: {yieldS ? <b>{q(yieldS)} {yU}</b> : 'не указан'}{c.shelf ? ' · 🕒 хранится ' + c.shelf : ''}</p>
      {yieldS
        ? <div className="amount"><span>Сколько сварить</span><input inputMode="decimal" value={amtShown} onChange={e => onAmt(e.target.value)} /><b>{yU}</b></div>
        : <div className="amount" style={{ background: 'var(--olive-soft)', color: 'var(--forest)' }}><span>Пересчёт по объёму появится, когда в техкарте будет указан выход</span></div>}
      <p className="sub" style={{ margin: '0 0 8px' }}>{info}</p>
      <div className="card" style={{ padding: '6px 14px' }}>
        <p className="sub" style={{ margin: '8px 0 4px' }}>💡 Есть ингредиент? Впиши, сколько его, — остальное пересчитается</p>
        {c.ings.map((i, k) => {
          const own = mode === 'have' && have[k] != null;
          const shown = raw?.k === k || own ? (raw?.k === k ? raw.text : String(have[k])) : vals[k] == null ? '' : q(vals[k]).replace(',', '.');
          return (
            <div key={k} className={'ing' + (own ? ' own' : '') + (mode === 'have' && limit === k && manyHave ? ' limit' : '')}>
              <span>{i.name}</span>
              <label className="field">
                <input data-ing={k} inputMode="decimal" disabled={!base[k]} value={shown}
                  onChange={e => onIng(k, e.target.value)}
                  onFocus={e => { if (!own) e.target.select(); }}
                  onBlur={() => setRaw(r => (r?.k === k ? null : r))} />
                <small>{i.unit}</small>
              </label>
            </div>
          );
        })}
        {mode === 'have' && <button className="btn soft" style={{ margin: '10px 0 8px', padding: 11 }} onClick={reset}>Сбросить</button>}
      </div>
      {c.method ? <><h3>Приготовление</h3><div className="card method">{c.method}</div></> : null}
      <button className="btn soft" onClick={closeSheet}>Закрыть</button>
    </Sheet>
  );
}
