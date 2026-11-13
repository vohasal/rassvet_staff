import { create } from 'zustand';
import { useCard, useMe } from '../../api/queries';
import type { CardData } from '../../api/types';
import { Await, Avatar, Card, StBadge } from '../../components/ui';

// чью карточку смотрим (админ может выбрать любого); null — свою
const useWho = create<{ name: string | null }>(() => ({ name: null }));

export default function ProfileView() {
  const me = useMe();
  const other = useWho(s => s.name);
  const want = other || me.name;
  const q = useCard(want, !!other);
  return <Await q={q}>{c => <Profile c={c} want={want} />}</Await>;
}

function Profile({ c, want }: { c: CardData; want: string }) {
  const me = useMe();
  const s = c.stats, mo = c.month;
  const got = c.badges.filter(b => b.got).length;
  const tile = (v: number, l: string) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>;
  const badges = c.badges.slice().sort((a, b) => Number(b.got) - Number(a.got));
  return (
    <>
      <Card>
        {c.people && c.people.length > 0 && (
          <label className="sub" style={{ display: 'block', margin: '0 0 10px' }}>Чья карточка
            <select style={{ marginTop: 6 }} value={want} onChange={e => useWho.setState({ name: e.target.value === me.name ? null : e.target.value })}>
              {[me.name].concat(c.people.filter(n => n !== me.name)).map(n => <option key={n}>{n}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={c.name} style={{ width: 56, height: 56, fontSize: 24 }} />
          <div className="pname">
            <b style={{ fontSize: 20 }}>{c.name}</b>
            <StBadge st={c.status} />
            <span style={{ display: 'block', marginTop: 4 }}>
              {c.rank ? '🏅 ' + c.rank.pos + '-е место по заготовкам за 2 недели (из ' + c.rank.of + ')' : 'Сваришь заготовку — попадёшь в рейтинг'}
            </span>
          </div>
        </div>
        <h3>За 30 дней</h3>
        <div className="stats">{tile(mo.m, 'заготовок')}{tile(mo.c, 'закрытий')}{tile(mo.pf, 'идеальных')}</div>
        <h3>За всё время</h3>
        <div className="stats">{tile(s.m, 'заготовок')}{tile(s.c, 'закрытий')}{tile(s.pf, 'идеальных')}{tile(s.t, 'задач')}{tile(s.sw, 'замен')}{tile(s.pr, 'проблем найдено')}</div>
      </Card>
      <Card>
        <h2>Достижения</h2>
        <p className="sub">Открыто {got} из {c.badges.length}</p>
        <div className="badges">
          {badges.map(b => (
            <div key={b.title} className={'badge2' + (b.got ? '' : ' off')}>
              <div className="ic">{b.icon}</div><b>{b.title}</b><small>{b.desc}</small>
              {!b.got && <><div className="bar"><i style={{ width: Math.round((b.have / b.goal) * 100) + '%' }} /></div><small>{b.have} из {b.goal}</small></>}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
