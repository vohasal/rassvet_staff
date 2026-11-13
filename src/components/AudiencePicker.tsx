import type { Audience, AudienceData } from '../api/types';
import { ST_LABEL, ST_LIST } from '../lib/statuses';

export const emptyAudience = (): Audience => ({ mode: 'all', statuses: [], ids: [] });
const toggle = (l: string[], v: string) => (l.includes(v) ? l.filter(x => x !== v) : [...l, v]);

/** Кому: всем / по статусу / админам / выбрать людей */
export function AudiencePicker({ f, d, withAdmins, onChange }: { f: Audience; d: AudienceData; withAdmins?: boolean; onChange: (f: Audience) => void }) {
  const modes: [Audience['mode'], string][] = [['all', 'Всем'], ['status', 'По статусу'], ...(withAdmins ? [['admins', 'Админам'] as [Audience['mode'], string]] : []), ['people', 'Выбрать людей']];
  return (
    <>
      <div className="seg">
        {modes.map(([m, l]) => <button key={m} className={f.mode === m ? 'on st3' : ''} onClick={() => onChange({ ...f, mode: m })}>{l}</button>)}
      </div>
      {f.mode === 'status' && (
        <div className="seg" style={{ marginTop: 10 }}>
          {(d.statuses || ST_LIST).map(st => (
            <button key={st} className={f.statuses.includes(st) ? 'on st' + ST_LIST.indexOf(st) : ''} onClick={() => onChange({ ...f, statuses: toggle(f.statuses, st) })}>{ST_LABEL[st]}</button>
          ))}
        </div>
      )}
      {f.mode === 'people' && (
        <div className="chips" style={{ marginTop: 10 }}>
          {(d.people || []).length
            ? d.people!.map(x => <button key={x.id} className={'chip' + (f.ids.includes(x.id) ? ' on' : '')} onClick={() => onChange({ ...f, ids: toggle(f.ids, x.id) })}>{x.name}</button>)
            : <p className="sub">Никто не подключён к боту</p>}
        </div>
      )}
    </>
  );
}
