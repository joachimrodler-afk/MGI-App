import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Hinweis, Seite } from '../components/ui';
import { config, istGesetzt } from '../config';
import { useEinstellungen } from '../lib/einstellungen';
import { klassen, markdown } from '../lib/helfer';

/**
 * Notfall & Platzordnung.
 * Funktioniert offline: Die App-Shell ist im Service Worker gespeichert, die Texte im lokalen Speicher.
 */
export default function Notfall() {
  const { einstellungen: e } = useEinstellungen();
  const [tab, setTab] = useState<'notfall' | 'ordnung'>('notfall');
  const [kopiert, setKopiert] = useState(false);
  const { lat, lon, koordinatenGeprueft, zufahrt, adresse } = config.platz;
  const koord = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const nord = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'Nord' : 'Süd'}, ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'Ost' : 'West'}`;

  async function kopieren() {
    try {
      await navigator.clipboard.writeText([koord, adresse, istGesetzt(zufahrt) ? zufahrt : ''].filter(Boolean).join(' – '));
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }

  return (
    <Seite titel={tab === 'notfall' ? 'Notfall' : 'Platzordnung'}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-himmel-100 p-1 dark:bg-slate-800" role="tablist">
        {(['notfall', 'ordnung'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={klassen('min-h-11 rounded-lg font-semibold', tab === t ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300')}>
            {t === 'notfall' ? 'Notfall' : 'Platzordnung'}
          </button>
        ))}
      </div>

      {tab === 'notfall' ? (
        <div className="space-y-4">
          <a href="tel:112" className="flex min-h-20 items-center justify-center gap-3 rounded-2xl bg-mgi-rot text-2xl font-extrabold text-white shadow-lg active:scale-[0.98]">
            <Icon name="telefon" className="h-8 w-8" /> Notruf 112
          </a>

          <div className="karte p-4">
            <h2 className="mb-2 font-bold">Standort für den Rettungsdienst</h2>
            <p className="text-sm text-slate-500">Zum Vorlesen am Telefon:</p>
            <p className="my-2 rounded-xl bg-himmel-50 p-3 text-lg font-bold dark:bg-slate-800">{nord}</p>
            <p className="mb-1"><b>Adresse:</b> {adresse}</p>
            {istGesetzt(zufahrt) && <p className="mb-3"><b>Zufahrt:</b> {zufahrt}</p>}
            {!koordinatenGeprueft && <Hinweis art="warnung">Die Koordinaten sind noch nicht eingetragen (aktuell Ortsmitte Ismaning). Bitte in config.ts ergänzen.</Hinweis>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={kopieren} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-himmel-100 font-semibold text-himmel-700 dark:bg-slate-800 dark:text-himmel-200">
                <Icon name={kopiert ? 'haken' : 'kopieren'} className="h-5 w-5" /> {kopiert ? 'Kopiert' : 'Kopieren'}
              </button>
              <a href={config.platz.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`} target="_blank" rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-himmel-100 font-semibold text-himmel-700 dark:bg-slate-800 dark:text-himmel-200">
                <Icon name="karte" className="h-5 w-5" /> In Karten öffnen
              </a>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`} target="_blank" rel="noopener noreferrer"
                className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-himmel-600 font-semibold text-white">
                <Icon name="flieger" className="h-5 w-5" /> Navigation zum Platz starten
              </a>
            </div>
          </div>

          {e.notfallInfo && (
            <div className="karte md p-4" dangerouslySetInnerHTML={{ __html: markdown(e.notfallInfo) }} />
          )}

          {e.notfallKontakte.length > 0 && (
            <div className="karte divide-y divide-himmel-100 dark:divide-slate-700">
              <h2 className="px-4 pt-3 font-bold">Wichtige Kontakte</h2>
              {e.notfallKontakte.map((k) => (
                <a key={k.telefon + k.name} href={`tel:${k.telefon.replace(/[^\d+]/g, '')}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="flex-1">
                    <span className="block font-semibold">{k.name}</span>
                    <span className="block text-sm text-slate-500">{k.rolle} · {k.telefon}</span>
                  </span>
                  <Icon name="telefon" className="h-6 w-6 text-mgi-rot" />
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="karte md p-4" dangerouslySetInnerHTML={{ __html: markdown(e.platzordnung || '_Die Platzordnung wurde noch nicht eingetragen._') }} />
      )}
    </Seite>
  );
}
