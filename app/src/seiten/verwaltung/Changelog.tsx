import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Fehler, Hinweis, Laden, Seite, useLaden } from '../../components/ui';
import { api } from '../../lib/api';

interface Changelog { text: string; url: string; geaendert: string }

const DATUM = /^\s*(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}|#+\s)/;

/** Textdatei schlicht darstellen: Datumszeilen als Überschrift, „- “ als Aufzählung. */
function Text({ text }: { text: string }) {
  const zeilen = text.replace(/\r/g, '').split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {zeilen.map((z, i) => {
        if (!z.trim()) return <div key={i} className="h-2" />;
        if (DATUM.test(z)) return <h2 key={i} className="pt-2 font-bold text-himmel-900 dark:text-himmel-100">{z.replace(/^#+\s*/, '')}</h2>;
        const punkt = z.match(/^\s*[-*•]\s+(.*)$/);
        if (punkt) return <div key={i} className="flex gap-2 pl-1"><span aria-hidden>•</span><span className="whitespace-pre-wrap">{punkt[1]}</span></div>;
        return <p key={i} className="whitespace-pre-wrap">{z}</p>;
      })}
    </div>
  );
}

function Inhalt() {
  const { daten, fehler, laedt, neu } = useLaden(() => api<Changelog>('changelog'));
  if (laedt && !daten) return <Laden />;
  if (fehler) return <Fehler fehler={fehler} nochmal={neu} />;
  if (!daten) return null;
  return (
    <div className="space-y-4">
      <div className="karte p-4"><Text text={daten.text} /></div>
      <p className="text-xs text-slate-500">Zuletzt geändert: {new Date(daten.geaendert).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      <a href={daten.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-himmel-700 ring-1 ring-himmel-300 hover:bg-himmel-50 dark:bg-slate-800 dark:text-himmel-200 dark:ring-slate-600">
        <Icon name="extern" className="h-5 w-5" /> In Google Drive bearbeiten
      </a>
      <Hinweis>Die Datei „MGI-App_Changelog.txt“ liegt in Drive im Ordner MGI → MGI-App. Neue Einträge oben einfügen: eine Zeile mit Datum, darunter Stichpunkte mit „- “.</Hinweis>
    </div>
  );
}

export default function ChangelogSeite() {
  return <Seite titel="Changelog"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
