import { useState } from 'react';
import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Fehler, Feld, Knopf, Laden, Leer, Seite, useLaden } from '../../components/ui';
import { api } from '../../lib/api';
import { herunterladen } from '../../lib/helfer';
import type { FlugbuchEintrag, FlugleiterEintrag } from '../../lib/model';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function csv(piloten: FlugbuchEintrag[]) {
  const kopf = ['Datum', 'Name', 'Vorname', 'Verein/Gast', 'Schulungsnachweis', 'Segler', 'Elektro', 'Kolben', 'Turbine', 'max. Masse', 'Beginn', 'Ende', 'automatisch beendet', 'eingetragen von', 'Besondere Vorkommnisse'];
  const x = (b: boolean) => (b ? 'x' : '');
  const zeilen = piloten.map((p) => [
    p.datum, p.name, p.vorname, p.vereinGast, p.schulungsnachweis ? 'ja' : 'nein',
    x(p.antrieb.includes('segler')), x(p.antrieb.includes('elektro')), x(p.antrieb.includes('kolben')), x(p.antrieb.includes('turbine')),
    p.masse, p.beginn, p.ende, p.autoBeendet ? 'ja' : '', p.eingetragenVon, p.vorkommnisse ?? '',
  ]);
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [kopf, ...zeilen].map((z) => z.map((v) => esc(String(v ?? ''))).join(';')).join('\r\n');
}

function Inhalt() {
  const jetzt = new Date();
  const [von, setVon] = useState(iso(new Date(jetzt.getFullYear(), jetzt.getMonth(), 1)));
  const [bis, setBis] = useState(iso(jetzt));
  const { daten, fehler, laedt, neu } = useLaden(
    () => api<{ piloten: FlugbuchEintrag[]; flugleiter: FlugleiterEintrag[]; tabelle: string }>('flugbuch_liste', { von, bis }), [von, bis]);

  // nach Tag gruppieren
  const tage = new Map<string, FlugbuchEintrag[]>();
  daten?.piloten.forEach((p) => tage.set(p.datum, [...(tage.get(p.datum) ?? []), p]));

  return (
    <div className="space-y-4">
      <div className="karte grid grid-cols-2 gap-3 p-4">
        <Feld label="Von"><input type="date" className="eingabe" value={von} onChange={(e) => setVon(e.target.value)} /></Feld>
        <Feld label="Bis"><input type="date" className="eingabe" value={bis} onChange={(e) => setBis(e.target.value)} /></Feld>
      </div>
      {laedt && !daten && <Laden />}
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      {daten && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Knopf art="sekundaer" onClick={() => herunterladen(`Flugbuch_${von}_${bis}.csv`, '﻿' + csv(daten.piloten), 'text/csv;charset=utf-8')}>
              <Icon name="download" className="h-5 w-5" /> CSV
            </Knopf>
            <a href={daten.tabelle} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-himmel-700 ring-1 ring-himmel-300 dark:bg-slate-800 dark:text-himmel-200">
              <Icon name="extern" className="h-5 w-5" /> Google-Tabelle
            </a>
          </div>
          <p className="text-sm text-slate-500">{daten.piloten.length} Einträge · {daten.flugleiter.length} × Flugleiter</p>
          {!daten.piloten.length && <Leer>Keine Einträge in diesem Zeitraum.</Leer>}
          {[...tage.entries()].map(([tag, liste]) => {
            const fl = daten.flugleiter.filter((f) => f.datum === tag);
            return (
              <div key={tag} className="karte overflow-hidden">
                <div className="bg-himmel-50 px-4 py-2 dark:bg-slate-800">
                  <p className="font-bold">{tag}</p>
                  {fl.map((f) => (
                    <p key={f.id} className="text-xs text-slate-600 dark:text-slate-400">
                      Flugleiter {f.vorname} {f.name} {f.beginn}–{f.ende || '…'} · Fangnetz {f.fangnetz ? 'ja' : 'nein'} · Rasen {f.rasenGemaeht ? 'ja' : 'nein'} · {f.wetter} · {f.windrichtung} {f.windstaerke}
                    </p>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead><tr className="text-left text-xs text-slate-500"><th className="px-3 py-1.5">Pilot</th><th className="px-1">V/G</th><th className="px-1">Antrieb</th><th className="px-1">Masse</th><th className="px-3 text-right">Zeit</th></tr></thead>
                    <tbody>
                      {liste.map((p) => [
                        <tr key={p.id} className="border-t border-himmel-100 dark:border-slate-800">
                          <td className="px-3 py-2 font-semibold">{p.vorname} {p.name}{p.schulungsnachweis && <span title="Schulungsnachweis"> ✓</span>}</td>
                          <td className="px-1">{p.vereinGast === 'Gast' ? 'G' : 'V'}</td>
                          <td className="px-1">{p.antrieb.map((a) => a[0].toUpperCase()).join('')}</td>
                          <td className="px-1">{p.masse}</td>
                          <td className="whitespace-nowrap px-3 text-right tabular-nums">{p.beginn}–{p.ende || '…'}{p.autoBeendet ? '*' : ''}</td>
                        </tr>,
                        p.vorkommnisse ? (
                          <tr key={p.id + '-v'}>
                            <td colSpan={5} className="whitespace-pre-line px-3 pb-2 text-xs text-amber-800 dark:text-amber-300">
                              <b>Vorkommnis:</b> {p.vorkommnisse}
                            </td>
                          </tr>
                        ) : null,
                      ])}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-500">S = Segler, E = Elektro, K = Kolben, T = Turbine · ✓ = Schulungsnachweis · * = automatisch abgemeldet</p>
        </>
      )}
    </div>
  );
}

export default function FlugbuchUebersicht() {
  return <Seite titel="Flugbuch-Übersicht"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
