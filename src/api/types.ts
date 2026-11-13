// Типы ответов сервера. Восстановлены по тому, как приложение их использует;
// необязательные поля — то, что сервер присылает не всегда.

export type Dict<T> = Record<string, T>;

export interface Prep {
  id: string; name: string; unit: string; min: number; norm?: number;
  tk?: string; frz?: boolean;
}

export interface NeedItem {
  pid: string; name: string; unit: string;
  need: number; left: number; have: number; norm: number;
  res?: boolean; frozen?: number;
}

export interface ShiftEntry {
  name: string; from: number; to: number;
  role?: string; word?: string; place?: string;
}

export interface Closed { by: string; at: number; items?: NeedItem[] }

export interface OffAsk { id: string; name: string; q: number; unit: string; made: number }

export interface Pickup {
  items: Dict<number>;
  picked?: { at: number; items: Dict<number> } | null;
}

export interface Gu { shifts: string[]; done?: boolean; mon: string }

export interface StockHandover {
  role: 'give' | 'take';
  give: string[]; take: string[];
  items: { t: string; d?: string }[];
  s?: { by: string; at: number; miss: string[]; note?: string; acc?: { by: string; at: number; note?: string } | null } | null;
}

export interface Me {
  name: string;
  isAdmin?: boolean; isViewer?: boolean; isOwner?: boolean;
  orderer?: boolean; canClose?: boolean; canCreate?: boolean;
  grTab?: boolean; grWe?: boolean;
  openTasks?: number;
  tabOrder?: string;
  statuses?: Dict<string>;
  preps: Prep[];
  checklist?: string[];
  today: {
    date: string; items: NeedItem[];
    made?: Dict<string>; yields?: Dict<number>; thawed?: Dict<boolean>; yEdit?: Dict<string>;
    done?: { none?: boolean };
  };
  now?: number;
  shift?: ShiftEntry[] | null;
  closers?: string[];
  closed?: Closed | null;
  last?: { by: string; ts: number; values?: Dict<number> } | null;
  cb?: Dict<{ day: string }[]>;       // партии в холодильнике по датам (для закрытия)
  offAsk?: OffAsk[];
  cashOut?: { exp?: number; toEnv?: number };
  lateDays?: number;
  order?: { date: string; items: Dict<number> };
  pickup?: Pickup | null;
  gu?: Gu | null;
  sk?: StockHandover | null;
}

export interface LabelItem { id: string; name: string; state?: 'f' | 'w'; made: number; exp?: number }
export interface WithLabel { label?: LabelItem[] }

export interface TechCard {
  id: string; title: string; hidden?: boolean; shelf?: string; method?: string;
  yields?: ({ n: number; u?: string } | null)[];
  ings: { name: string; unit: string; amounts: (number | null)[] }[];
}

export interface Swap {
  id: string; date: string; from: number; to: number;
  mine?: boolean; mode?: 'swap' | 'give'; status: 'open' | 'taken';
  byName: string; takerName?: string;
}
export interface HomeData {
  week?: { date: string; from: number; to: number; none?: boolean; off?: boolean; role?: string }[];
  swaps?: Swap[];
  bdays?: Dict<string>;
  probs?: { id: string; text: string; byName: string; at: number; photos?: number }[];
}

export interface CashOp {
  id: string; kind: 'in' | 'exp'; amount: number; what: string; date: string;
  src: 'kassa' | 'env'; srcLabel: string; byName: string; at: number;
  canceled?: boolean; edited?: boolean; back?: boolean; canEdit?: boolean;
  kd?: string; cat?: string; person?: string; note?: string; from?: string;
}
export interface CashData {
  today: string; days: string[]; cats: string[]; people: string[];
  ops: CashOp[];
  env?: { known: boolean; exp: number; baseDate: string; baseBy: string; base: number; ins: number; exps: number };
}
export interface CashPreview {
  big: boolean; short: boolean; known: boolean; tol: number; noteMin: number;
  kd: number; ed: number;
  hint?: { text?: string; ops?: { a: number; what: string; near?: boolean; by?: string }[] };
}

export interface Audience { mode: 'all' | 'status' | 'admins' | 'people'; statuses: string[]; ids: string[] }
export interface AudienceData { statuses?: string[]; people?: { id: string; name: string }[] }

export interface TaskPhotos { name: string; ids: string[] }
export interface Task {
  id: string; text: string; byName: string; due?: string; doneMe?: boolean; needPhoto?: boolean;
}
export interface CreatedTask {
  id: string; text: string; to: string; doneCnt: number; total: number; leftNames: string[]; photos?: TaskPhotos[];
}
export interface TasksData extends AudienceData { mine: Task[]; created: CreatedTask[]; canCreate?: boolean }

export interface EventsData extends AudienceData {
  canCreate?: boolean;
  events: { id: string; title: string; date: string; time: string; to: string; note?: string; canDel?: boolean }[];
}
export interface BookingsData {
  canAdd?: boolean;
  bookings: { id: string; guest: string; people: number; date: string; time: string; phone?: string; note?: string; byName: string; canDel?: boolean }[];
}

export interface Batch {
  id: string; pid: string; name: string; unit: string; state: 'w' | 'f';
  made: number; exp?: number; q: number; q0?: number; by?: string;
  thaw?: boolean; cnt?: boolean; ext?: number; mark?: boolean; aliveBlock?: 'limit' | 'day' | string;
}
export interface FridgeData {
  canEdit?: boolean; batches: Batch[]; frz: Prep[];
  autoOff?: { id: string; name: string; q: number; unit: string; made: number; till: number }[];
}

export interface CardData {
  name: string; status?: string; people?: string[];
  rank?: { pos: number; of: number } | null;
  stats: { m: number; c: number; pf: number; t: number; sw: number; pr: number };
  month: { m: number; c: number; pf: number };
  badges: { icon: string; title: string; desc: string; got: boolean; have: number; goal: number }[];
}

export interface CfgPrep {
  name: string; unit: string; min: number | string; norm: number | string;
  tk?: string | null; shelf?: string | number; frzDays?: string | number;
  low?: number | string | null; frz?: boolean; nd?: Dict<string | number>;
  [k: string]: unknown;
}
export interface Config {
  preps: CfgPrep[]; checklist?: string[];
  schedule?: string[]; off?: string[]; extra?: string[]; exclude: string[];
  users: { id: string; name: string }[]; viewers?: string[];
  statuses?: Dict<string>; bdays?: Dict<string>;
}

export interface GrDay { date: string; free?: boolean; left?: number | null; z?: '' | 'ok' | 'wait'; names?: string[]; cap?: number | null }
export interface GrReq { open?: boolean; done?: boolean; from: string; to: string; dlText: string; days?: GrDay[] }
export interface GrafikData {
  isAdmin?: boolean; canEdit?: boolean; inList?: boolean; maxOff?: number;
  req?: GrReq | null; days?: GrDay[];
  mine?: { d: string[]; note?: string; done?: boolean } | null;
  answers?: { name: string; z?: { date: string; st: string; r: string }[] }[];
  wait?: string[]; job?: boolean;
  next?: { from: string; to: string; dlText: string; ahead?: boolean; err?: string } | null;
  draft?: {
    from: string; to: string; month: string; sheet: string; url: string; status: string;
    wishes?: number; wishOk?: number; notes: string[]; issues: string[];
    urls?: { sheet: string; url: string }[]; sent?: number; sendNote?: string;
  } | null;
  snap?: { at: number; ask?: string } | null;
  msg?: string; conflict?: boolean;
}

export interface Closing {
  date: string; by: string; ts: number; photos?: string[];
  values?: Dict<number>;
  checks?: { done: number; total: number; items?: { ok: boolean; t: string }[]; missing: string[] } | null;
}

export interface RegDoc { title: string; text: string; err?: string }

export interface CountResult { items?: NeedItem[]; extra?: { pid: string; name: string; q: number; unit: string; back?: { id: string; made: number } }[] }
