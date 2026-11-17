import { useState } from 'react';
import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Fehler, Feld, Knopf, Laden, Leer, Seite, useLaden } from '../../components/ui';
import { api } from '../../lib/api';
import { herunterladen } from '../../lib/helfer';
import type { FlugbuchEintrag, FlugleiterEintrag } from '../../lib/model';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const AUTO = 'automatisch abgemeldet';
const endeText = (ende: string, auto: boolean) => (auto ? `${ende} ${AUTO}` : ende);
/** TT.MM.JJJJ → sortierbar */
const sortTag = (d: string) => d.split('.').reverse().join('');

/** Export nach StRfF 8.1.7: Hinweis, Betriebstage, Piloten, Flugleiter, Besondere Ereignisse (eigene Abteilung) */
function csv(piloten: FlugbuchEintrag[], flugleiter: FlugleiterEintrag[]) {
  const x = (b: boolean) => (b ? 'x' : '');
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const block = (z: unknown[][]) => z.map((r) => r.map((v) => esc(String(v ?? ''))).join(';'));

  // Betriebstage: chronologisch, mit Beginn und Ende des Flugbetriebs am Tag
  const tage = new Map<string, { beginn: string; ende: string; auto: boolean; piloten: number; fl: number }>();
  for (const p of piloten) {
    const t = tage.get(p.datum) ?? { beginn: p.beginn, ende: '', auto: false, piloten: 0, fl: 0 };
    if (p.beginn < t.beginn) t.beginn = p.beginn;
    if (p.ende && p.ende >= t.ende) { t.auto = p.ende === t.ende ? t.auto || p.autoBeendet : p.autoBeendet; t.ende = p.ende; }
    t.piloten++;
    tage.set(p.datum, t);
  }
  for (const f of flugleiter) { const t = tage.get(f.datum); if (t) t.fl++; }
  const tagZeilen = [...tage.entries()].sort((a, b) => sortTag(a[0]).localeCompare(sortTag(b[0])))
    .map(([d, t]) => [d, t.beginn, t.ende ? endeText(t.ende, t.auto) : 'läuft', t.piloten, t.fl ? 'ja' : 'nein']);

  const chrono = (a: { datum: string; beginn: string }, b: { datum: string; beginn: string }) =>
    (sortTag(a.datum) + a.beginn).localeCompare(sortTag(b.datum) + b.beginn);
  const kopf = ['Datum', 'Name', 'Vorname', 'Verein/Gast', 'Fernsteuerkanal', 'Schulungsnachweis', 'Segler (kein Antrieb)', 'Elektro', 'Verbrenner (Kolben)', 'Turbine', 'anderer Antrieb', 'max. Masse', 'Beginn', 'Ende', 'eingetragen von'];
  const zeilen = piloten.slice().sort(chrono).map((p) => [
    p.datum, p.name, p.vorname, p.vereinGast, p.kanal, p.schulungsnachweis ? 'ja' : 'nein',
    x(p.antrieb.includes('segler')), x(p.antrieb.includes('elektro')), x(p.antrieb.includes('kolben')), x(p.antrieb.includes('turbine')), x(p.antrieb.includes('anderer')),
    p.masse, p.beginn, endeText(p.ende, p.autoBeendet), p.eingetragenVon,
  ]);
  const flKopf = ['Datum', 'Name', 'Vorname', 'Beginn', 'Ende', 'Fangnetz aufgebaut', 'Rasen gemäht', 'Wetter', 'Windrichtung', 'Windstärke'];
  const flZeilen = flugleiter.slice().sort(chrono).map((f) => [
    f.datum, f.name, f.vorname, f.beginn, endeText(f.ende, f.autoBeendet),
    f.fangnetz ? 'ja' : 'nein', f.rasenGemaeht ? 'ja' : 'nein', f.wetter, f.windrichtung, f.windstaerke,
  ]);
  const ereignisse = piloten.filter((p) => (p.vorkommnisse ?? '').trim()).sort(chrono)
    .map((p) => [p.datum, p.beginn, `${p.vorname} ${p.name}`, p.vorkommnisse]);

  return [
    'Modellflugbuch Modellbau-Gemeinschaft Ismaning e.V.',
    esc('Hinweis: Mit seiner Eintragung im Modellflugbuch bestätigt der Pilot die Geltung der Standardisierten Regeln für Flugmodelle (StRfF) des MFSD sowie der Flugbetriebsordnung der MGI.'),
    '', 'Betriebstage', ...block([['Datum', 'Beginn Flugbetrieb', 'Ende Flugbetrieb', 'Piloten', 'Flugleiter'], ...tagZeilen]),
    '', 'Piloten', ...block([kopf, ...zeilen]),
    '', 'Flugleiter', ...block([flKopf, ...flZeilen]),
    '', 'Besondere Ereignisse', ...block([['Datum', 'Uhrzeit (Anmeldung)', 'Pilot', 'Ereignis'], ...(ereignisse.length ? ereignisse : [['keine']])]),
  ].join('\r\n');
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
            <Knopf art="sekundaer" onClick={() => herunterladen(`Flugbuch_${von}_${bis}.csv`, '﻿' + csv(daten.piloten, daten.flugleiter), 'text/csv;charset=utf-8')}>
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
                      Flugleiter {f.vorname} {f.name} {f.beginn}–{f.ende || '…'}{f.autoBeendet ? ` ${AUTO}` : ''} · Fangnetz {f.fangnetz ? 'ja' : 'nein'} · Rasen {f.rasenGemaeht ? 'ja' : 'nein'} · {f.wetter} · {f.windrichtung} {f.windstaerke}
                    </p>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead><tr className="text-left text-xs text-slate-500"><th className="px-3 py-1.5">Pilot</th><th className="px-1">V/G</th><th className="px-1">Antrieb</th><th className="px-1">Masse</th><th className="px-1">Kanal</th><th className="px-3 text-right">Zeit</th></tr></thead>
                    <tbody>
                      {liste.map((p) => [
                        <tr key={p.id} className="border-t border-himmel-100 dark:border-slate-800">
                          <td className="px-3 py-2 font-semibold">{p.vorname} {p.name}{p.schulungsnachweis && <span title="Schulungsnachweis"> ✓</span>}</td>
                          <td className="px-1">{p.vereinGast === 'Gast' ? 'G' : 'V'}</td>
                          <td className="px-1">{p.antrieb.map((a) => a[0].toUpperCase()).join('')}</td>
                          <td className="px-1">{p.masse}</td>
                          <td className="px-1">{p.kanal}</td>
                          <td className="whitespace-nowrap px-3 text-right tabular-nums">{p.beginn}–{p.ende || '…'}{p.autoBeendet ? ` ${AUTO}` : ''}</td>
                        </tr>,
                        p.vorkommnisse ? (
                          <tr key={p.id + '-v'}>
                            <td colSpan={6} className="whitespace-pre-line px-3 pb-2 text-xs text-amber-800 dark:text-amber-300">
                              <b>Besonderes Ereignis:</b> {p.vorkommnisse}
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
          <p className="text-xs text-slate-500">S = Segler, E = Elektro, K = Kolben, T = Turbine, A = anderer Antrieb · ✓ = Schulungsnachweis</p>
        </>
      )}
    </div>
  );
}

export default function FlugbuchUebersicht() {
  return <Seite titel="Flugbuch-Übersicht"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
