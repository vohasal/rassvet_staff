import { getTg } from './telegram';

// Адрес сервера приходит из ссылки, которой бот открывает приложение: ?api=...
export const API_URL = new URLSearchParams(location.search).get('api');

type Transport = (action: string, payload: unknown, method: 'GET' | 'POST') => Promise<unknown>;

// По умолчанию — настоящий сервер. В режиме разработки main.tsx подменяет на локальный мок.
let transport: Transport = async (action, payload, method) => {
  const initData = getTg()?.initData ?? '';
  let r: Response;
  if (method === 'POST') {
    // большие данные (фото) — POST-телом
    r = await fetch(API_URL!, { method: 'POST', body: JSON.stringify({ action, initData, payload }) });
  } else {
    const q = new URLSearchParams({ action, initData });
    if (payload) q.set('payload', JSON.stringify(payload));
    r = await fetch(API_URL + '?' + q.toString());
  }
  return r.json();
};

export function setTransport(t: Transport) { transport = t; }

async function send<T>(action: string, payload: unknown, method: 'GET' | 'POST'): Promise<T> {
  const j = (await transport(action, payload, method)) as { error?: string };
  if (j && j.error) throw new Error(j.error);
  return j as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const call = <T = any>(action: string, payload?: unknown) => send<T>(action, payload ?? null, 'GET');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const post = <T = any>(action: string, payload?: unknown) => send<T>(action, payload ?? null, 'POST');

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
