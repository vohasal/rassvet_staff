/* eslint-disable @typescript-eslint/no-explicit-any */
// Тестовые данные и обработчики действий сервера (упрощённо — только чтобы приложение можно было прокликать)
import type { Batch, CashData, CashOp, Config, FridgeData, GrafikData, Me, TasksData, TechCard } from '../api/types';

type Handlers = Record<string, (p: any) => any>;
const DAY = 864e5;
const tash = (ts = Date.now()) => new Date(ts + 5 * 36e5).toISOString().slice(0, 10);
const addD = (d: string, n: number) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
const nowMin = () => { const d = new Date(Date.now() + 5 * 36e5); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
let seq = 100;
const id = () => 'm' + ++seq;
// крошечная серая картинка вместо настоящих фото
const PIXEL = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#A9B67C"/><text x="100" y="110" font-size="40" text-anchor="middle" fill="#0A3320">фото</text></svg>');

export function createDb(role: string): Handlers {
  const today = tash();
  const isAdmin = role === 'admin', orderer = role === 'point';
  const name = orderer ? 'Яндекс Азиз' : isAdmin ? 'Искандер' : 'Милена';

  const preps = [
    { id: 'p1', name: 'Сироп ваниль', unit: 'л', min: 1, norm: 2, tk: 't1' },
    { id: 'p2', name: 'Лимонад база', unit: 'л', min: 2, norm: 4, tk: 't2' },
    { id: 'p3', name: 'Тыквенное пюре', unit: 'кг', min: 0.5, norm: 1.5, frz: true },
    { id: 'p4', name: 'Соус карамель', unit: 'шт', min: 2, norm: 6 },
  ];
  const shift = (d: string) => {
    const k = new Date(d).getUTCDate() % 3;
    return [
      { name: 'Милена', from: 8 * 60, to: 16 * 60, role: 'касса' },
      { name: 'Роман', from: 9 * 60, to: 17 * 60 },
      { name: 'Никита', from: 15 * 60, to: 23 * 60 },
      ...(k ? [{ name: 'Катя', from: 16 * 60, to: 23 * 60, role: 'холодка' }] : []),
      { name: 'Искандер', from: 10 * 60, to: 19 * 60, place: 'Управляющий' },
      { name: 'Узум Азиз', from: 9 * 60, to: 18 * 60 },
    ];
  };

  const me: Me = {
    name, isAdmin, isViewer: false, isOwner: false, orderer, canClose: true, canCreate: isAdmin,
    grTab: true, grWe: false, openTasks: 2, tabOrder: '',
    statuses: { 'Милена': 'бариста', 'Роман': 'старший бариста', 'Никита': 'стажер', 'Катя': 'про бариста', 'Искандер': 'управляющий' },
    preps,
    checklist: ['Почистить кофемашину', 'Вымыть питчеры', 'Вынести мусор', 'Закрыть кассу'],
    today: {
      date: today,
      items: [
        { pid: 'p1', name: 'Сироп ваниль', unit: 'л', need: 1.5, left: 0, have: 0.5, norm: 2 },
        { pid: 'p3', name: 'Тыквенное пюре', unit: 'кг', need: 1, left: 0.1, have: 0.1, norm: 1.5, frozen: 2 },
      ],
      made: {}, yields: {}, thawed: {}, yEdit: {},
    },
    now: nowMin(),
    shift: shift(today),
    closers: ['Никита', 'Катя'],
    closed: null,
    last: { by: 'Никита', ts: Date.now() - DAY, values: { p1: 0.5, p2: 3, p3: 0.1, p4: 4 } },
    cb: { p1: [{ day: addD(today, -2) }, { day: addD(today, -1) }], p2: [{ day: addD(today, -1) }] },
    offAsk: [],
    cashOut: { exp: 50000 },
    lateDays: 3,
    order: { date: addD(today, 1), items: { p1: 1 } },
    pickup: orderer ? { items: { p1: 1, p2: 2 }, picked: null } : null,
    gu: { shifts: ['пн 8:00–16:00'], done: false, mon: today },
    sk: { role: 'give', give: ['Милена'], take: ['Никита', 'Катя'], items: [{ t: 'Протереть полки', d: 'и проверить сроки' }, { t: 'Разобрать поставку' }], s: null },
  };

  const cards: TechCard[] = [
    { id: 't1', title: 'Сироп ваниль', shelf: '7 суток', method: 'Сахар и воду довести до кипения.\nДобавить ваниль, снять с огня, остудить.', yields: [{ n: 1, u: 'л' }], ings: [{ name: 'Сахар', unit: 'г', amounts: [800] }, { name: 'Вода', unit: 'мл', amounts: [600] }, { name: 'Ваниль', unit: 'г', amounts: [10] }] },
    { id: 't2', title: 'Лимонад база', shelf: '3 суток', yields: [{ n: 2, u: 'л' }], ings: [{ name: 'Лимон', unit: 'шт', amounts: [8] }, { name: 'Сахар', unit: 'г', amounts: [400] }] },
    { id: 't3', title: 'Старый соус', hidden: true, ings: [{ name: 'Сливки', unit: 'мл', amounts: [500] }] },
  ];

  const cashOps: CashOp[] = [
    { id: 'c1', kind: 'exp', amount: 50000, what: 'Хлеб', date: today, src: 'kassa', srcLabel: 'Касса ' + today.slice(8), byName: 'Милена', at: Date.now() - 3 * 36e5, canEdit: true, cat: 'Хлеб', kd: today },
  ];
  const cash = (): CashData => ({
    today, days: [today, addD(today, -1), addD(today, -2)], cats: ['Хлеб', 'ЗП стажёру', 'Продукты', 'Хозтовары', 'Другое'], people: ['Никита'],
    ops: cashOps.slice().sort((a, b) => b.at - a.at),
    env: { known: true, exp: 2350000, baseDate: addD(today, -1), baseBy: 'Никита', base: 2300000, ins: 100000, exps: 50000 },
  });

  const batches: Batch[] = [
    { id: 'b1', pid: 'p1', name: 'Сироп ваниль', unit: 'л', state: 'w', made: Date.now() - 2 * DAY, exp: Date.now() + DAY / 2, q: 0.5, q0: 1, by: 'Роман' },
    { id: 'b2', pid: 'p2', name: 'Лимонад база', unit: 'л', state: 'w', made: Date.now() - 4 * DAY, exp: Date.now() - DAY / 3, q: 2, q0: 2, by: 'Катя', mark: true },
    { id: 'b3', pid: 'p3', name: 'Тыквенное пюре', unit: 'кг', state: 'f', made: Date.now() - 10 * DAY, exp: Date.now() + 20 * DAY, q: 2, q0: 3, by: 'Никита' },
  ];
  const fridge = (): FridgeData => ({ canEdit: true, batches, frz: [preps[2]], autoOff: [] });

  const tasks: TasksData = {
    canCreate: isAdmin,
    mine: [
      { id: 'k1', text: 'Протереть полки за кофемашиной', byName: 'Искандер', due: 'до пятницы', needPhoto: true },
      { id: 'k2', text: 'Проверить сроки в холодильнике', byName: 'Искандер' },
    ],
    created: isAdmin ? [{ id: 'k9', text: 'Помыть витрину', to: 'всем', doneCnt: 1, total: 3, leftNames: ['Роман', 'Катя'], photos: [{ name: 'Милена', ids: ['ph1', 'ph2'] }] }] : [],
    people: [{ id: 'u1', name: 'Милена' }, { id: 'u2', name: 'Роман' }],
  };
  const events = { canCreate: isAdmin, events: [{ id: 'e1', title: 'Собрание команды', date: addD(today, 2), time: '18:00', to: 'всем', note: 'Новое меню', canDel: isAdmin }], people: tasks.people };
  const bookings = { canAdd: true, bookings: [{ id: 'bk1', guest: 'Анна', people: 4, date: today, time: '19:30', phone: '+998 90 123 45 67', note: 'Стол у окна', byName: 'Милена', canDel: true }] };

  const cfg: Config = {
    preps: preps.map(p => ({ ...p, shelf: '', low: null, nd: {} })), checklist: me.checklist,
    schedule: ['Милена', 'Роман', 'Никита', 'Катя'], off: [], extra: ['Аля'], exclude: ['Яндекс', 'Узум'],
    users: [{ id: 'u1', name: 'Милена' }, { id: 'u2', name: 'Роман' }], viewers: ['u2'],
    statuses: me.statuses, bdays: { 'Роман': addD(today, 1).slice(5) },
  };

  let grafik: GrafikData = {
    isAdmin, canEdit: isAdmin, inList: true, maxOff: 3,
    req: { open: true, from: addD(today, 3), to: addD(today, 9), dlText: 'суббота 18:00' },
    days: [{ date: addD(today, 4), free: false, left: 0, z: '' }, { date: addD(today, 5), free: true, left: 2, z: '' }],
    mine: { d: [], note: '', done: false }, wait: ['Катя'], answers: [], job: false,
    next: { from: addD(today, 10), to: addD(today, 16), dlText: 'пятница 18:00', ahead: true },
    draft: { from: addD(today, -4), to: addD(today, 2), month: 'Ноябрь', sheet: 'Черновик', url: 'https://example.com', status: 'new', wishes: 5, wishOk: 4, notes: ['Роман: утро'], issues: [] },
    snap: null,
  };

  const ok = (msg?: string) => ({ ok: true, msg });
  const markMade = (pids: string[], yields: Record<string, number>) => {
    const t = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    pids.forEach(pid => { me.today.made![pid] = name + ' ' + t; me.today.yields![pid] = yields[pid]; });
    return { label: pids.map(pid => ({ id: id(), name: preps.find(p => p.id === pid)!.name, made: Date.now(), exp: Date.now() + 3 * DAY })) };
  };

  return {
    me: () => me,
    tk: () => ({ cards }),
    config: () => cfg,
    home: () => ({
      week: [0, 1, 2, 3, 4, 5, 6].map(i => ({ date: addD(today, i), from: 8 * 60, to: 16 * 60, off: i === 3, none: i === 6 })),
      swaps: [{ id: 's1', date: addD(today, 2), from: 15 * 60, to: 23 * 60, mode: 'give', status: 'open', byName: 'Никита' }],
      bdays: cfg.bdays,
      probs: [{ id: 'pr1', text: 'Кофемолка №2 мелет неравномерно', byName: 'Роман', at: Date.now() - 5 * 36e5, photos: 1 }],
    }),
    shiftDay: ({ date }) => ({ list: date > addD(today, 5) ? null : shift(date) }),
    refreshSchedule: () => ok(),
    swapAsk: () => ok(), swapTake: () => ({ ok: true }), swapCancel: () => ok(), probDone: () => ok(), probAdd: () => ok(), dishOrder: () => ok(),
    photoUpload: () => ({ id: id() }), taskPhoto: () => ({ id: id() }), probPhoto: () => ({ id: id() }), guPhoto: () => ({ id: id() }),
    photo: () => ({ data: PIXEL }),
    guDone: () => { me.gu!.done = true; return ok(); },
    skGive: ({ checks, note }) => { me.sk!.s = { by: name, at: Date.now(), miss: me.sk!.items.filter((_, i) => !checks.includes(i)).map(x => x.t), note, acc: null }; return ok(); },
    skAcc: () => ({ msg: 'Спасибо!' }),
    made: ({ pids, yields }) => markMade(pids, yields),
    madeLate: () => ({ label: [] }),
    thaw: ({ pid, q, today: t }) => { if (t) { me.today.made![pid] = name; me.today.thawed![pid] = true; me.today.yields![pid] = q; } return { label: [] }; },
    freeze: () => ({ label: [] }),
    editYield: ({ pid, q }) => { me.today.yields![pid] = q; me.today.yEdit![pid] = name; return ok(); },
    undoMade: ({ pid }) => { delete me.today.made![pid]; delete me.today.yields![pid]; delete me.today.thawed![pid]; return ok(); },
    count: ({ values }) => {
      const items = preps.filter(p => values[p.id] != null && values[p.id] < p.min).map(p => ({ pid: p.id, name: p.name, unit: p.unit, need: p.norm - values[p.id], left: 0, have: values[p.id], norm: p.norm }));
      me.closed = { by: name, at: Date.now(), items };
      return { items, extra: [] };
    },
    cashPreview: ({ cash: c }) => {
      const kd = c.cf - (c.ik - 50000), ed = c.env - 2350000;
      const big = Math.abs(kd) > 20000 || Math.abs(ed) > 20000;
      return { big, short: kd < -20000 || ed < -20000, known: true, tol: 20000, noteMin: 15, kd, ed, hint: { text: 'Проверь, всё ли записано', ops: [{ a: 50000, what: 'Хлеб', by: 'Милена', near: true }] } };
    },
    autoOffOk: () => ok(), batchReturn: () => ok(), batchExtra: () => ok(),
    cash: () => cash(),
    cashAdd: (p) => { cashOps.push({ id: id(), kind: p.kind, amount: p.amount, what: p.cat || 'Внесение', date: p.kd || today, src: p.src, srcLabel: p.src === 'env' ? 'Конверт' : 'Касса', byName: name, at: Date.now(), canEdit: true, ...p }); return cash(); },
    cashEdit: (p) => { const o = cashOps.find(x => x.id === p.id)!; if (p.cancel) o.canceled = true; else Object.assign(o, p, { edited: true }); return cash(); },
    tasks: () => tasks,
    taskDone: ({ id: tid }) => { const t = tasks.mine.find(x => x.id === tid); if (t) t.doneMe = true; me.openTasks = Math.max(0, (me.openTasks || 1) - 1); return ok(); },
    taskAdd: () => ok(), taskDel: ({ id: tid }) => { tasks.created = tasks.created.filter(x => x.id !== tid); return ok(); },
    events: () => events, eventAdd: () => ok(), eventDel: () => ok(),
    bookings: () => bookings,
    bookingAdd: (p) => { bookings.bookings.push({ id: id(), byName: name, canDel: true, ...p }); return ok(); },
    bookingDel: ({ id: bid }) => { bookings.bookings = bookings.bookings.filter(x => x.id !== bid); return ok(); },
    fridge: () => fridge(),
    batchMark: ({ ids }) => { batches.forEach(b => { if (ids.includes(b.id)) b.mark = false; }); return ok(); },
    batchDone: ({ id: bid }) => { const i = batches.findIndex(b => b.id === bid); if (i >= 0) batches.splice(i, 1); return ok(); },
    batchAlive: ({ id: bid }) => { const b = batches.find(x => x.id === bid); if (b) b.exp = Date.now() + DAY; return ok(); },
    card: ({ name: n } = {}) => ({
      name: n || name, status: me.statuses![n || name], people: isAdmin ? ['Милена', 'Роман', 'Никита'] : [],
      rank: { pos: 2, of: 7 }, stats: { m: 48, c: 21, pf: 15, t: 9, sw: 3, pr: 4 }, month: { m: 12, c: 6, pf: 5 },
      badges: [
        { icon: '🥄', title: 'Первая заготовка', desc: 'Сварить первую заготовку', got: true, have: 1, goal: 1 },
        { icon: '👑', title: 'Король заготовок', desc: '100 заготовок', got: false, have: 48, goal: 100 },
        { icon: '🌙', title: 'Ночной страж', desc: '10 закрытий', got: true, have: 21, goal: 10 },
      ],
    }),
    grafik: () => grafik,
    grWish: ({ d, note }) => { grafik = { ...grafik, mine: { d, note, done: true } }; return grafik; },
    grZ: ({ date }) => { grafik = { ...grafik, days: (grafik.days || []).map(x => (x.date === date ? { ...x, z: 'wait' } : x)) }; return grafik; },
    grVac: () => ({ ...grafik, msg: 'Заявка отправлена админу' }),
    grGenNow: () => ({ ...grafik, job: true }), grDone: () => grafik, grStartNext: () => grafik,
    grApprove: () => { grafik = { ...grafik, draft: { ...grafik.draft!, status: 'done' } }; return grafik; },
    grManual: () => grafik, grSend: () => ({ ...grafik, msg: 'Разослано' }), grRegen: () => grafik, grRestore: () => grafik,
    history: () => ({ items: [{ date: addD(today, -1), by: 'Никита', ts: Date.now() - 20 * 36e5, photos: ['ph1', 'ph2', 'ph3'], values: { p1: 0.5, p2: 3 }, checks: { done: 3, total: 4, missing: ['Вынести мусор'] } }] }),
    reportNow: () => ok(), weekNow: () => ok(), briefNow: () => ok(),
    regs: () => ({ docs: [{ title: 'Стандарты бара', text: '1. Внешний вид\n• Форма чистая и выглаженная\n• Волосы собраны\n2. Опоздания\nОпоздание больше 10 минут — штраф.' }] }),
    train: () => ({ eps: [{ n: 1, t: 'Знакомство', ready: true }, { n: 2, t: 'Закрытие смены', ready: false }] }),
    trainSend: () => ok(),
    tabOrder: ({ o }) => { me.tabOrder = o.join(','); return ok(); },
    tkHide: ({ id: cid, hidden }) => { const c = cards.find(x => x.id === cid); if (c) c.hidden = hidden; return ok(); },
    savePreps: ({ preps: ps }) => ({ preps: ps }),
    saveChecklist: ({ items }) => { me.checklist = items; return { checklist: items }; },
    saveStaff: () => ok(),
    setStatus: ({ name: n, status }) => { me.statuses![n] = status; return { statuses: me.statuses }; },
    setBirthday: ({ name: n, date }) => { cfg.bdays![n] = date; return { bdays: cfg.bdays }; },
    setViewer: ({ id: uid, on }) => { cfg.viewers = on ? [...(cfg.viewers || []), uid] : (cfg.viewers || []).filter(x => x !== uid); return { viewers: cfg.viewers }; },
    removeUser: ({ id: uid }) => { cfg.users = cfg.users.filter(u => u.id !== uid); return ok(); },
    whoToday: () => ({ prep: ['Милена', 'Роман'], count: ['Никита'], countAt: '22:30' }),
    order: ({ items }) => { me.order = { date: addD(today, 1), items }; return ok(); },
    orderPickup: ({ items }) => { me.pickup = { items: me.pickup!.items, picked: { at: Date.now(), items } }; return { pickup: me.pickup }; },
  };
}
