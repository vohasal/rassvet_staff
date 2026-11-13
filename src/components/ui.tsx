import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import logo from '../assets/logo.jpg';
import { avatarOf } from '../lib/avatars';
import { firstLetter } from '../lib/format';
import { ST_LABEL, ST_LIST } from '../lib/statuses';
import { errMsg } from '../lib/api';

export const Card = ({ children, style, className = '', id }: { children: ReactNode; style?: CSSProperties; className?: string; id?: string }) => (
  <div className={'card ' + className} style={style} id={id}>{children}</div>
);

export const Empty = ({ icon, title, text }: { icon: ReactNode; title: ReactNode; text?: ReactNode }) => (
  <Card>
    <div className="empty">
      <div className="icon">{icon}</div>
      <h2>{title}</h2>
      {text ? <p className="sub">{text}</p> : null}
    </div>
  </Card>
);

/** Логотип-пульс «Загружаю…». Появляется через 120 мс, чтобы быстрые загрузки не мигали */
export function Loader({ small = false }: { small?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t); }, []);
  if (!show) return null;
  const inner = (
    <div className="loader" style={small ? { minHeight: 160 } : undefined}>
      <img src={logo} alt="" style={small ? { width: 56, height: 56 } : undefined} />
      <span>Загружаю…</span>
    </div>
  );
  return small ? <Card>{inner}</Card> : inner;
}

export const ErrorCard = ({ error }: { error: unknown }) => (
  <Card><p style={{ color: 'var(--danger)', margin: 0 }}>{errMsg(error)}</p></Card>
);

/** Вкладка ждёт данные: загрузка → ошибка → содержимое */
export function Await<T>({ q, children }: { q: { data?: T; error: unknown; isPending: boolean }; children: (d: T) => ReactNode }) {
  if (q.data !== undefined) return <>{children(q.data)}</>;
  if (q.error) return <ErrorCard error={q.error} />;
  return <Loader small />;
}

/** Фото сотрудника или кружок с буквой */
export function Avatar({ name, style }: { name: string; style?: CSSProperties }) {
  const src = avatarOf(name);
  if (src) return <img className="ava" src={src} alt="" loading="lazy" style={{ objectFit: 'cover', ...style }} />;
  return <div className="ava" style={style}>{firstLetter(name)}</div>;
}

/** Цветной бейдж статуса: «Бариста», «Старший бариста»… */
export const StBadge = ({ st, style }: { st?: string; style?: CSSProperties }) =>
  st ? <span className={'stb st' + ST_LIST.indexOf(st)} style={style}>{ST_LABEL[st] || st}</span> : null;

export const Mini = ({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <span className={'mini ' + className} style={style}>{children}</span>
);

/** Плавающая кнопка внизу экрана */
export const Dock = ({ children, hide, id }: { children: ReactNode; hide?: boolean; id?: string }) => (
  <div className={'dock' + (hide ? ' hide' : '')} id={id}>{children}</div>
);
