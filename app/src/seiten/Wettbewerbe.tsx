import { Link } from 'react-router-dom';
import { LoginFormular } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Fehler, Laden, Leer, Seite, useLaden } from '../components/ui';
import { api } from '../lib/api';
import { datumKurz, klassen } from '../lib/helfer';
import { useSitzung } from '../lib/sitzung';

interface Kurz { id: string; name: string; datum: string; artName: string; status: 'offen' | 'abgeschlossen'; teilnehmer: number }

export default function Wettbewerbe() {
  const s = useSitzung();
  const { daten, fehler, laedt, neu } = useLaden(() => api<Kurz[]>('wettbewerbe'), [s?.token]);
  const admin = s?.rolle === 'admin';

  return (
    <Seite titel="Wettbewerbe" zurueck={false} aktion={admin && (
      <Link to="/wettbewerbe/neu" className="flex h-11 items-center gap-1 rounded-full bg-mgi-rot px-4 font-semibold text-white"><Icon name="plus" className="h-5 w-5" /> Neu</Link>
    )}>
      {laedt && !daten && <Laden />}
      {fehler && (fehler.includes('anmelden') ? <LoginFormular text="Ergebnisse sind nur für Mitglieder sichtbar." /> : <Fehler fehler={fehler} nochmal={neu} />)}
      {daten && !daten.length && <Leer>Noch keine Wettbewerbe angelegt.</Leer>}
      <div className="space-y-3">
        {daten?.map((w) => (
          <Link key={w.id} to={`/wettbewerbe/${w.id}`} className="karte flex items-center gap-4 p-4 hover:shadow-md">
            <span className={klassen('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', w.status === 'offen' ? 'bg-red-100 text-mgi-rot' : 'bg-sonne-hell text-amber-700')}>
              <Icon name="pokal" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{w.name}</span>
              <span className="block text-sm text-slate-500">{w.artName} · {datumKurz(w.datum)} · {w.teilnehmer} Teilnehmer</span>
            </span>
            {w.status === 'offen' && <span className="rounded-full bg-mgi-rot px-2.5 py-0.5 text-xs font-bold text-white">läuft</span>}
            <Icon name="rechts" className="h-5 w-5 text-slate-400" />
          </Link>
        ))}
      </div>
      {admin && (
        <Link to="/verwaltung/wertungsarten" className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl font-semibold text-himmel-700 dark:text-himmel-200">
          <Icon name="zahnrad" className="h-5 w-5" /> Wertungsarten & Formeln bearbeiten
        </Link>
      )}
    </Seite>
  );
}
