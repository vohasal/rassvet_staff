import logo from '../assets/logo.jpg';
import type { Me } from '../api/types';
import { avatarOf } from '../lib/avatars';
import { firstLetter } from '../lib/format';
import { openSheet, type TabKey } from '../store/ui';

// инструкция большая — грузим её только по нажатию «?»
const openHelp = () => import('../features/help/HelpSheet').then(m => openSheet(<m.HelpSheet />));

const Loop = () => (
  <svg className="loop" viewBox="0 0 200 200" fill="none" stroke="#F2F5CF" strokeWidth="5" strokeLinecap="round">
    <path d="M20 150c30-10 50-40 60-70s5-55 25-60 30 20 15 45-40 30-35 10 30-25 55-10 10 45-20 50-25-20 5-30 45 0 40 30" />
  </svg>
);

export function Header({ me, tab, onProfile }: { me: Me; tab: TabKey; onProfile: () => void }) {
  const first = String(me.name || '').split(' ')[0];
  const ava = avatarOf(me.name);
  // справа сверху: «?» — инструкция, кружок — профиль (у точек Яндекс/Узум их нет)
  const acts = me.orderer && !me.isAdmin ? null : (
    <div className="hero-acts">
      <button className="hbtn" aria-label="Инструкция" onClick={openHelp}>?</button>
      <button
        className={'hbtn me' + (tab === 'profile' ? ' on' : '')}
        aria-label="Профиль"
        style={ava ? { background: `url('${ava}') center/cover`, color: 'transparent' } : undefined}
        onClick={onProfile}
      >{firstLetter(me.name)}</button>
    </div>
  );
  return (
    <div className="hero">
      <Loop />{acts}
      <div className="brand">
        <img className="logo" src={logo} alt="" />
        <div><h1>Рассвет</h1><p>Твоя любимая кофейня🫶</p></div>
      </div>
      <div className="hello">Привет, {first} 👋</div>
    </div>
  );
}
