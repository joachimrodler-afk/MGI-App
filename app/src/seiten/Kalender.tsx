import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ExternerLink, Fehler, Laden, Leer, Seite, useLaden } from '../components/ui';
import { config } from '../config';
import { api, erinnere, merke } from '../lib/api';
import { herunterladen, lokal, tageBis, terminDatum, terminIcs } from '../lib/helfer';
import type { Termin } from '../lib/model';

export default function Kalender() {
  const { daten, fehler, laedt, neu } = useLaden(async () => {
    try {
      const t = await api<Termin[]>('termine');
      merke('termine', t);
      return t;
    } catch (e) {
      const alt = erinnere<Termin[]>('termine');
      if (alt) return alt;
      throw e;
    }
  });
  const [offen, setOffen] = useState<number | null>(null);
  const liste = (daten ?? []).slice(0, config.kalender.anzahlTermine);

  let letzterMonat = '';
  return (
    <Seite titel="Termine" zurueck={false}>
      {laedt && !daten && <Laden />}
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      {daten && !liste.length && <Leer>Keine kommenden Termine.</Leer>}
      <div className="space-y-2">
        {liste.map((t, i) => {
          const l = lokal(t.beginn);
          const monat = l.datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
          const kopf = monat !== letzterMonat ? monat : '';
          letzterMonat = monat;
          return (
            <div key={t.titel + t.beginn}>
              {kopf && <h2 className="mb-1 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500 first:mt-0">{kopf}</h2>}
              <div className="karte overflow-hidden">
                <button onClick={() => setOffen(offen === i ? null : i)} className="flex w-full items-center gap-4 p-3 text-left" aria-expanded={offen === i}>
                  <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-himmel-600 text-white">
                    <span className="text-xl font-extrabold leading-none">{l.tag}</span>
                    <span className="text-[11px] font-semibold uppercase">{l.datum.toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{t.titel}</span>
                    <span className="block text-sm text-slate-600 dark:text-slate-400">
                      {t.ganztaegig ? 'ganztägig' : terminDatum(t.beginn, false, t.ende).split(', ').pop()}
                      {t.ort ? ` · ${t.ort}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-mgi-rot">{i < 3 ? tageBis(t.beginn) : ''}</span>
                </button>
                {offen === i && (
                  <div className="border-t border-himmel-100 px-4 py-3 text-sm dark:border-slate-700">
                    <p className="mb-1 font-semibold">{terminDatum(t.beginn, t.ganztaegig, t.ende)}</p>
                    {t.ort && <p className="mb-1">📍 {t.ort}</p>}
                    {t.beschreibung && <p className="mb-2 whitespace-pre-line text-slate-600 dark:text-slate-400">{t.beschreibung}</p>}
                    <button
                      onClick={() => herunterladen(`${t.titel.replace(/[^\w\-äöüÄÖÜß ]/g, '')}.ics`, terminIcs(t), 'text/calendar')}
                      className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-xl bg-himmel-100 px-3 font-semibold text-himmel-700 dark:bg-slate-800 dark:text-himmel-200"
                    >
                      <Icon name="kalender" className="h-5 w-5" /> In meinen Kalender
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ExternerLink href={config.kalender.webUrl}
        className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-himmel-700 ring-1 ring-himmel-300 dark:bg-slate-800 dark:text-himmel-200">
        <Icon name="extern" className="h-5 w-5" /> Vollständiger Kalender
      </ExternerLink>
    </Seite>
  );
}
