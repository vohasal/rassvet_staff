// Клавиатура на телефоне: тап мимо поля — спрятать; Enter — к следующему полю количества
export function initKeyboard() {
  const isField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
    !!el && ((el.tagName === 'INPUT' && !/^(checkbox|radio|file|button|submit|date|time)$/.test((el as HTMLInputElement).type)) || el.tagName === 'TEXTAREA');
  const hide = () => { const a = document.activeElement; if (isField(a)) a.blur(); };

  let sx = 0, sy = 0;
  document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!isField(document.activeElement)) return;
    const t = e.target as HTMLElement, c = e.changedTouches[0];
    if (Math.abs(c.clientX - sx) > 10 || Math.abs(c.clientY - sy) > 10) return;   // это был скролл
    if (isField(t) || t.closest?.('label,select,button,.field')) return;
    hide();
  }, { passive: true });

  // Enter: в подсчёте, заказе и техкарте — к следующему полю, иначе закрыть клавиатуру
  document.addEventListener('keydown', e => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || t.tagName !== 'INPUT') return;
    e.preventDefault();
    const list = [...document.querySelectorAll<HTMLInputElement>('input[data-id],input[data-oid],input[data-ing]')].filter(i => !i.disabled);
    const i = list.indexOf(t as HTMLInputElement);
    if (i >= 0 && list[i + 1]) { list[i + 1].focus(); list[i + 1].select?.(); } else hide();
  });
}
