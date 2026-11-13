import { useEffect, useId, useState } from 'react';
import { call, errMsg, post } from '../lib/api';
import { lightbox, toast } from '../store/ui';

export interface Photo { key: number; src: string; loading?: boolean; id?: string }
type Update = (fn: (list: Photo[]) => Photo[]) => void;

/** Сжать фото с телефона до 1280px по длинной стороне, JPEG 72% */
export function compress(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Не удалось открыть фото')); };
    img.src = url;
  });
}

let seq = 0;
export const photoKey = () => ++seq;

/** Сжать и загрузить фото по одному. action — куда грузить (photoUpload, taskPhoto…) */
export async function uploadPhotos(files: File[], action: string, update: Update, opts: { errText?: (e: unknown) => string; onUploaded?: () => void } = {}) {
  for (const f of files) {
    let src: string;
    try { src = await compress(f); } catch (e) { toast(errMsg(e)); continue; }
    const key = photoKey();
    update(l => [...l, { key, src, loading: true }]);
    post<{ id: string }>(action, { data: src })
      .then(r => { update(l => l.map(p => (p.key === key ? { ...p, id: r.id, loading: false } : p))); opts.onUploaded?.(); })
      .catch(e => { toast(opts.errText ? opts.errText(e) : 'Фото не загрузилось'); update(l => l.filter(p => p.key !== key)); });
  }
}

/** Сетка фото с кнопкой «+ Фото» */
export function PhotoGrid({ photos, max, onAdd, onRemove, zoom = false, id }: {
  photos: Photo[]; max: number; onAdd: (files: File[]) => void; onRemove: (i: number) => void; zoom?: boolean; id?: string;
}) {
  const inputId = useId();
  return (
    <>
      <div className="photos" id={id}>
        {photos.map((p, k) => (
          <div className={'ph' + (p.loading ? ' loading' : '')} key={p.key}>
            <img src={p.src} alt="" onClick={zoom ? () => lightbox(p.src) : undefined} />
            <button className="x" onClick={() => onRemove(k)}>×</button>
          </div>
        ))}
        {photos.length < max && (
          <label className="ph add" htmlFor={inputId}><span><b>+</b>Фото</span></label>
        )}
      </div>
      <input type="file" id={inputId} accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { const files = [...(e.target.files || [])].slice(0, max - photos.length); e.target.value = ''; onAdd(files); }} />
    </>
  );
}

// Фото с сервера по id (история закрытий, фото к задачам). Кеш на всё время работы приложения
const photoCache: Record<string, Promise<string>> = {};
export function RemotePhoto({ id }: { id: string }) {
  const [st, setSt] = useState<{ src?: string; err?: boolean }>({});
  useEffect(() => {
    let alive = true;
    photoCache[id] = photoCache[id] || call<{ data: string }>('photo', { id }).then(r => r.data);
    photoCache[id].then(src => alive && setSt({ src }), () => { delete photoCache[id]; if (alive) setSt({ err: true }); });
    return () => { alive = false; };
  }, [id]);
  if (st.err) return <div className="ph"><span className="sub" style={{ fontSize: 12 }}>не загрузилось</span></div>;
  return (
    <div className={'ph' + (st.src ? '' : ' loading')}>
      <img alt="" src={st.src} onClick={st.src ? () => lightbox(st.src!) : undefined} />
    </div>
  );
}
