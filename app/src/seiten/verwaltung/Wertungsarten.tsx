import { Link } from 'react-router-dom';
import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Fehler, Laden, Seite, useLaden } from '../../components/ui';
import { alleArten } from '../../lib/arten';

function Inhalt() {
  const { daten, fehler, laedt, neu } = useLaden(alleArten);
  return (
    <div className="space-y-3">
      <Link to="/verwaltung/wertungsarten/neu" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mgi-rot font-semibold text-white"><Icon name="plus" /> Neue Wertungsart</Link>
      {laedt && !daten && <Laden />}
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      <div className="karte divide-y divide-himmel-100 overflow-hidden dark:divide-slate-700">
        {daten?.map((a) => (
          <Link key={a.id} to={`/verwaltung/wertungsarten/${a.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-himmel-50 dark:hover:bg-slate-800">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{a.name}</span>
              <code className="block truncate text-xs text-slate-500">{a.formel}</code>
            </span>
            <span className="text-xs text-slate-500">{a.vorlage ? 'Vorlage' : `v${a.version}`}</span>
            <Icon name="rechts" className="h-5 w-5 text-slate-400" />
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-500">Änderungen an einer Formel gelten für neue Wettbewerbe. Laufende Wettbewerbe behalten ihre Formel-Version.</p>
    </div>
  );
}

export default function Wertungsarten() {
  return <Seite titel="Wertungsarten & Formeln"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
