import type { NeedItem } from '../api/types';
import { fmt } from '../lib/format';

/** Строка «что сварить»: остаток, норма, сколько добавить */
export function NeedRow({ i }: { i: NeedItem }) {
  return (
    <div className="need">
      <div className="dot">{(String(i.name).trim()[0] || '•').toUpperCase()}</div>
      <div className="pname">
        <b>{i.name}</b>
        <span>
          осталось {i.left > 0 ? fmt(i.left) + ' ' + i.unit + ' — почти пусто' : fmt(i.have) + ' ' + i.unit} · норма {fmt(i.norm)}
          {i.res ? ' с запасом' : ''}{(i.frozen || 0) > 0 ? ' · ❄️ в морозилке ' + fmt(i.frozen) : ''}
        </span>
      </div>
      <div className="pill">+{fmt(i.need)} {i.unit}</div>
    </div>
  );
}
