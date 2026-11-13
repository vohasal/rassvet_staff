import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Me } from '../api/types';
import { patchMe } from '../api/queries';
import { call, errMsg } from '../lib/api';
import { haptic, hapticImpact, hapticSelect } from '../lib/telegram';
import { toast, type TabKey } from '../store/ui';
import { tabsList } from './tabs';

interface Drag {
  key: TabKey; id: number; x0: number; y0: number; px: number; grab: number;
  on: boolean; timer?: number; raf?: number;
}

/** Полоса вкладок. Зажал вкладку ~0,4 с → тащи → отпустил: свой порядок сохраняется в боте */
export function TabBar({ me, tab, onSelect }: { me: Me; tab: TabKey; onSelect: (t: TabKey) => void }) {
  const base = tabsList(me);
  const [order, setOrder] = useState<TabKey[] | null>(null);   // порядок во время перетаскивания
  const [lifted, setLifted] = useState<TabKey | null>(null);
  const list = order ? order.map(k => base.find(t => t.key === k)!).filter(Boolean) : base;

  const barRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<TabKey, HTMLButtonElement>());
  const orderRef = useRef<TabKey[]>(base.map(t => t.key));
  const drag = useRef<Drag | null>(null);
  const dragEnd = useRef(0);
  const baseKeys = base.map(t => t.key).join();
  if (!order) orderRef.current = base.map(t => t.key);

  // активная вкладка — по центру полосы (первый раз сразу, потом плавно)
  const first = useRef(true);
  useLayoutEffect(() => {
    const bar = barRef.current, on = els.current.get(tab);
    if (!bar || !on) return;
    const target = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    requestAnimationFrame(() => bar.scrollTo({ left: target, behavior: first.current ? 'auto' : 'smooth' }));
    first.current = false;
  }, [tab]);

  useEffect(() => {
    const bar = barRef.current!;
    const nat = (el: HTMLElement) => el.offsetLeft - bar.scrollLeft;

    const place = () => {
      const s = drag.current!; const el = els.current.get(s.key)!;
      const w = el.offsetWidth, vis = s.px - s.grab;
      const keys = orderRef.current, others = keys.filter(k => k !== s.key);
      let idx = 0;
      others.forEach(k => { const t = els.current.get(k)!; if (nat(t) + t.offsetWidth / 2 < vis + w / 2) idx++; });
      if (keys.indexOf(s.key) !== idx) {
        const before = new Map(others.map(k => [k, nat(els.current.get(k)!)]));
        const next = [...others]; next.splice(idx, 0, s.key);
        orderRef.current = next;
        flushSync(() => setOrder(next));
        // остальные вкладки плавно съезжают на новое место
        others.forEach(k => {
          const t = els.current.get(k)!, dx = before.get(k)! - nat(t);
          if (!dx) return;
          t.style.transition = 'none'; t.style.transform = `translateX(${dx}px)`; void t.offsetWidth;
          t.style.transition = 'transform .18s ease'; t.style.transform = '';
        });
        hapticSelect();
      }
      el.style.transform = `translateX(${vis - nat(el)}px) scale(1.06)`;
    };
    // у края полосы — сама прокручивается, чтобы дотащить до начала или конца
    const tick = () => {
      const s = drag.current; if (!s || !s.on) return;
      const edge = 44, W = bar.clientWidth;
      const v = s.px < edge ? -Math.ceil((edge - s.px) / 4) : s.px > W - edge ? Math.ceil((s.px - W + edge) / 4) : 0;
      if (v) { const x0 = bar.scrollLeft; bar.scrollLeft += v; if (bar.scrollLeft !== x0) place(); }
      s.raf = window.setTimeout(tick, 16);
    };
    const start = () => {
      const s = drag.current; if (!s) return;
      s.on = true;
      s.grab = s.px - nat(els.current.get(s.key)!);
      setLifted(s.key);
      hapticImpact();
      place(); s.raf = window.setTimeout(tick, 16);
    };
    const finish = () => {
      const s = drag.current; if (!s) return;
      drag.current = null; clearTimeout(s.timer);
      if (!s.on) return;
      clearTimeout(s.raf); dragEnd.current = Date.now();
      const el = els.current.get(s.key); if (el) el.style.transform = '';
      setLifted(null);
      const ord = orderRef.current;
      setOrder(null);
      if (ord.join() === baseKeys) return;
      patchMe({ tabOrder: ord.join(',') });
      haptic('success');
      call('tabOrder', { o: ord }).catch(e => toast('Порядок не сохранился: ' + errMsg(e)));
    };

    const down = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab');
      if (!el || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag.current = { key: el.dataset.tab as TabKey, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, grab: 0, px: e.clientX - bar.getBoundingClientRect().left };
      drag.current.timer = window.setTimeout(start, 400);
    };
    const move = (e: PointerEvent) => {
      const s = drag.current; if (!s || e.pointerId !== s.id) return;
      s.px = e.clientX - bar.getBoundingClientRect().left;
      // палец поехал раньше, чем «зажал» — это прокрутка
      if (!s.on) { if (Math.abs(e.clientX - s.x0) > 8 || Math.abs(e.clientY - s.y0) > 8) { clearTimeout(s.timer); drag.current = null; } return; }
      place();
    };
    const up = (e: PointerEvent) => { if (drag.current && e.pointerId === drag.current.id) finish(); };
    const noScroll = (e: TouchEvent) => { if (drag.current?.on) e.preventDefault(); };
    const noMenu = (e: Event) => e.preventDefault();

    bar.addEventListener('pointerdown', down);
    bar.addEventListener('contextmenu', noMenu);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchmove', noScroll, { passive: false });
    return () => {
      bar.removeEventListener('pointerdown', down);
      bar.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', noScroll);
    };
  }, [baseKeys]);

  return (
    <div className="tabs-wrap">
      <div className={'tabs' + (lifted ? ' drag' : '')} ref={barRef}>
        {list.map(t => (
          <button
            key={t.key}
            data-tab={t.key}
            ref={el => { if (el) els.current.set(t.key, el); else els.current.delete(t.key); }}
            className={'tab' + (t.key === tab ? ' on' : '') + (lifted === t.key ? ' lift' : '')}
            onClick={() => { if (t.key === tab || Date.now() - dragEnd.current < 400) return; onSelect(t.key); }}
          >
            {t.label}{t.count ? <span className="tabcount">{t.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
