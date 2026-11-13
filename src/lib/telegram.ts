// Обёртка над Telegram WebApp: тема, вибрация, подтверждения, ссылки.
// Любой вызов может упасть в старом клиенте Telegram — поэтому всё в try/catch.

export interface TelegramWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  onEvent(event: string, cb: () => void): void;
  disableVerticalSwipes?: () => void;
  showConfirm(text: string, cb: (ok: boolean) => void): void;
  openLink(url: string): void;
  HapticFeedback: {
    notificationOccurred(type: 'success' | 'error' | 'warning'): void;
    selectionChanged(): void;
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const getTg = (): TelegramWebApp | undefined => window.Telegram?.WebApp;

export function haptic(type: 'success' | 'error' | 'warning') {
  try { getTg()!.HapticFeedback.notificationOccurred(type); } catch { /* нет вибрации */ }
}
export function hapticSelect() {
  try { getTg()!.HapticFeedback.selectionChanged(); } catch { /* нет вибрации */ }
}
export function hapticImpact() {
  try { getTg()!.HapticFeedback.impactOccurred('medium'); } catch { /* нет вибрации */ }
}

export function confirmBox(text: string): Promise<boolean> {
  return new Promise(res => {
    try { getTg()!.showConfirm(text, ok => res(ok)); } catch { res(window.confirm(text)); }
  });
}

export function openLink(url: string) {
  try { getTg()!.openLink(url); } catch { window.open(url, '_blank'); }
}

export function applyTheme() {
  const tg = getTg();
  const dark = tg?.colorScheme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { tg!.setHeaderColor('#96A466'); tg!.setBackgroundColor(dark ? '#0E1611' : '#FAFBEF'); } catch { /* старый клиент */ }
}
