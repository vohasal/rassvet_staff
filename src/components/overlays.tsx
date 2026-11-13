import { useEffect, useState, type ReactNode } from 'react';
import { closeSheet, useUi } from '../store/ui';

/** Нижняя шторка. Тап по затемнению — закрыть */
export function Sheet({ children, onClose = closeSheet }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="sheet-bg" id="sheet" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

/** Место, где показывается открытая шторка, всплывашка и фото на весь экран */
export function Overlays() {
  const sheet = useUi(s => s.sheet);
  const box = useUi(s => s.lightbox);
  return (
    <>
      {sheet}
      {box && (
        <div className="lightbox" onClick={() => useUi.setState({ lightbox: null })}>
          <img src={box} alt="" />
        </div>
      )}
      <Toast />
    </>
  );
}

function Toast() {
  const t = useUi(s => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!t) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(id);
  }, [t]);
  return <div id="toast" className={show ? 'show' : ''}>{t?.text}</div>;
}
