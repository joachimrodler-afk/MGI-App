/**
 * Arbeitsdienst – Mitglieder tragen sich selbst in freie Plätze der Arbeitsliste ein.
 * Eintragen ist verbindlich: austragen können nur Admins (bzw. der Vorstand direkt in der Tabelle).
 */
import { useState } from 'react';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { ExternerLink, Fehler, Hinweis, Knopf, Laden, Leer, Seite, useLaden } from '../components/ui';
import { api } from '../lib/api';
import { klassen } from '../lib/helfer';
import type { ArbeitsdienstListe, ArbeitsdienstWocheVoll } from '../lib/model';
import { useSitzung } from '../lib/sitzung';

const tag = (iso: string) => { const [j, m, t] = iso.split('-').map(Number); return new Date(j, m - 1, t); };
const kurz = (iso: string) => tag(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

function WochenKarte({ w, admin, arbeitet, frage, setFrage, eintragen, austragen }: {
  w: ArbeitsdienstWocheVoll; admin: boolean; arbeitet: string; frage: string; setFrage: (k: string) => void;
  eintragen: (zeile: number, kw: string) => void; austragen: (zeile: number, platz: number, name: string) => void;
}) {
  const meins = w.einsaetze.some((e) => e.plaetze.some((p) => p?.ich));
  return (
    <div className={klassen('karte overflow-hidden', meins && 'ring-2 ring-amber-400', w.vorbei && 'opacity-60')}>
      <div className={klassen('flex items-baseline gap-2 px-4 pb-1 pt-3', meins && 'bg-amber-50 dark:bg-amber-950')}>
        <span className="text-lg font-extrabold">{w.kw}</span>
        <span className="text-sm text-slate-600 dark:text-slate-400">{kurz(w.von)}–{kurz(w.bis)}</span>
        {meins && <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">Du bist dabei</span>}
      </div>
      <div className="divide-y divide-himmel-100 dark:divide-slate-700">
        {w.einsaetze.map((e) => {
          const ichSchon = e.plaetze.some((p) => p?.ich);
          const frei = e.plaetze.some((p) => !p);
          const k = `${e.zeile}`;
          return (
            <div key={e.zeile} className="px-4 py-3">
              <p className="font-bold">{e.einsatz}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {e.plaetze.map((p, i) => p ? (
                  <span key={i} className={klassen('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold',
                    p.ich ? 'bg-amber-200 text-amber-900' : 'bg-himmel-100 text-himmel-800 dark:bg-slate-700 dark:text-slate-100')}>
                    <Icon name="person" className="h-4 w-4" /> {p.ich ? 'Du' : p.name}
                    {admin && !w.vorbei && (
                      frage === `aus:${k}:${i}` ? (
                        <button className="ml-1 rounded-full bg-mgi-rot px-2 text-xs text-white" disabled={!!arbeitet}
                          onClick={() => austragen(e.zeile, i, p.name)}>{arbeitet === `aus:${k}:${i}` ? '…' : 'entfernen?'}</button>
                      ) : (
                        <button className="ml-1 text-slate-500" aria-label={`${p.name} austragen`} onClick={() => setFrage(`aus:${k}:${i}`)}>✕</button>
                      )
                    )}
                  </span>
                ) : (
                  <span key={i} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-400 dark:border-slate-600">frei</span>
                ))}
              </div>
              {!w.vorbei && frei && !ichSchon && (
                frage === `ein:${k}` ? (
                  <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950">
                    <p className="mb-2">Verbindlich für <b>{e.einsatz}</b> in {w.kw} eintragen? Austragen geht danach nur über den Vorstand.</p>
                    <div className="flex gap-2">
                      <Knopf className="flex-1 !min-h-10" laedt={arbeitet === `ein:${k}`} onClick={() => eintragen(e.zeile, w.kw)}>Ja, eintragen</Knopf>
                      <Knopf art="sekundaer" className="!min-h-10" onClick={() => setFrage('')}>Abbrechen</Knopf>
                    </div>
                  </div>
                ) : (
                  <Knopf art="sekundaer" className="mt-2 !min-h-10 w-full text-sm" onClick={() => setFrage(`ein:${k}`)}>
                    <Icon name="plus" className="h-4 w-4" /> Mich eintragen
                  </Knopf>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Inhalt() {
  const s = useSitzung()!;
  const admin = s.rolle === 'admin';
  const { daten, setDaten, fehler, laedt, neu } = useLaden(() => api<ArbeitsdienstListe>('arbeitsdienst_liste'), [s.token]);
  const [frage, setFrage] = useState('');
  const [arbeitet, setArbeitet] = useState('');
  const [fehler2, setFehler2] = useState('');
  const [alle, setAlle] = useState(false);

  async function aktion(name: string, d: Record<string, unknown>, k: string) {
    setArbeitet(k); setFehler2('');
    try { setDaten(await api<ArbeitsdienstListe>(name, d)); setFrage(''); }
    catch (e) { setFehler2((e as Error).message); void neu(); }
    finally { setArbeitet(''); }
  }

  if (laedt && !daten) return <Laden />;
  if (!daten) return fehler ? <Fehler fehler={fehler} nochmal={neu} /> : null;

  const kommend = daten.wochen.filter((w) => !w.vorbei);
  const vorbei = daten.wochen.filter((w) => w.vorbei);
  const meine = kommend.filter((w) => w.einsaetze.some((e) => e.plaetze.some((p) => p?.ich)));
  const karte = (w: ArbeitsdienstWocheVoll) => (
    <WochenKarte key={w.kw + w.von} w={w} admin={admin} arbeitet={arbeitet} frage={frage} setFrage={setFrage}
      eintragen={(zeile, kw) => aktion('arbeitsdienst_eintragen', { zeile, kw }, `ein:${zeile}`)}
      austragen={(zeile, platz, name) => aktion('arbeitsdienst_austragen', { zeile, platz, name }, `aus:${zeile}:${platz}`)} />
  );

  return (
    <div className="space-y-4">
      <Hinweis>
        {meine.length
          ? <>Du bist eingetragen in <b>{meine.map((w) => w.kw).join(', ')}</b>. Die App erinnert dich eine Woche vorher.</>
          : <>Such dir einen freien Platz aus und tippe auf „Mich eintragen“. Die App erinnert dich eine Woche vorher.</>}
      </Hinweis>
      {fehler2 && <Fehler fehler={fehler2} />}
      {kommend.length ? kommend.map(karte) : <Leer>Keine kommenden Arbeitsdienste in der Liste.</Leer>}
      {vorbei.length > 0 && (
        alle ? vorbei.map(karte) : <Knopf art="leise" className="w-full" onClick={() => setAlle(true)}>Vergangene Wochen zeigen ({vorbei.length})</Knopf>
      )}
      {admin && daten.tabelle && (
        <ExternerLink href={daten.tabelle} className="karte flex items-center gap-3 p-4 font-semibold text-himmel-700 dark:text-himmel-200">
          <Icon name="extern" className="h-6 w-6" /> Arbeitsliste in Google Tabellen öffnen (nur Admins)
        </ExternerLink>
      )}
    </div>
  );
}

export default function Arbeitsdienst() {
  return (
    <Seite titel="Arbeitsdienst">
      <NurMitglied text="Für den Arbeitsdienst bitte anmelden.">
        <Inhalt />
      </NurMitglied>
    </Seite>
  );
}
