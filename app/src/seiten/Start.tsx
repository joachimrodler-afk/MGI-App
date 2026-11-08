import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { config, istGesetzt } from '../config';
import { api, erinnere, merke } from '../lib/api';
import { useEinstellungen } from '../lib/einstellungen';
import { klassen, tageBis, terminDatum } from '../lib/helfer';
import type { ArbeitsdienstWoche, BluettiAntwort, Termin, WetterstationAntwort } from '../lib/model';
import { useSitzung } from '../lib/sitzung';
import { himmelsrichtung, ladeWetter, windAmpel, type WetterJetzt } from '../lib/wetter';
import { AkkuRing } from '../components/AkkuRing';

interface StartDaten {
  oeffentlich: boolean;
  anwesend: { anzahl: number; flugleiter: boolean; liste?: { mitgliedId: string; seit: string; flugleiter: boolean }[] };
  termine?: Termin[];
  bluetti?: BluettiAntwort;
  wetterstation?: WetterstationAntwort;
  /** nur angemeldet: eigene kommende Arbeitsdienst-Wochen */
  arbeitsdienst?: ArbeitsdienstWoche[];
}

/** Hinweis auf eigenen Arbeitsdienst: ab 14 Tage vorher bis Ende der Woche */
function ArbeitsdienstHinweis({ w }: { w: ArbeitsdienstWoche }) {
  const tag = (iso: string) => { const [j, m, t] = iso.split('-').map(Number); return new Date(j, m - 1, t); };
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const tage = Math.round((tag(w.von).getTime() - heute.getTime()) / 86400000);
  if (tage > 14) return null;
  const kurz = (iso: string) => tag(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const wann = tage <= 0 ? 'Diese Woche' : tage <= 7 ? 'Nächste Woche' : `In ${tage} Tagen`;
  const inhalt = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        <Icon name="schaufel" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">{wann} · {w.kw}</span>
        <span className="block font-bold">Du hast Arbeitsdienst</span>
        <span className="block text-sm text-slate-700 dark:text-slate-300">{kurz(w.von)}–{kurz(w.bis)} · {w.einsaetze.join(', ') || 'Arbeitsdienst'}</span>
      </span>
    </>
  );
  const kl = 'mb-4 flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950';
  return <Link to="/arbeitsdienst" className={kl}>{inhalt}</Link>;
}

function Kachel({ zu, href, icon, titel, children, farbe = 'blau', breit }: { zu?: string; href?: string; icon: string; titel: string; children?: ReactNode; farbe?: 'blau' | 'rot' | 'gelb'; breit?: boolean }) {
  const ring = { blau: 'bg-himmel-100 text-himmel-700 dark:text-himmel-300', rot: 'bg-red-100 text-mgi-rot dark:text-red-400', gelb: 'bg-sonne-hell text-amber-700 dark:text-sonne' }[farbe];
  const innen = (
    <>
      <span className={klassen('flex h-11 w-11 items-center justify-center rounded-xl dark:bg-slate-800', ring)}>
        <Icon name={icon} />
      </span>
      <span className="mt-2 block font-bold leading-tight">{titel}</span>
      {children && <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">{children}</span>}
    </>
  );
  const cls = klassen('karte block min-h-32 p-4 transition hover:shadow-md active:scale-[0.98]', breit && 'col-span-2');
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{innen}</a>;
  return <Link to={zu!} className={cls}>{innen}</Link>;
}

export default function Start() {
  const s = useSitzung();
  const { einstellungen } = useEinstellungen();
  const [d, setD] = useState<StartDaten | null>(() => erinnere<StartDaten>('start'));
  const [wetter, setWetter] = useState<WetterJetzt | null>(() => erinnere<WetterJetzt>('wetter'));

  useEffect(() => {
    let wetterZeit = 0;
    const laden = () => {
      api<StartDaten>('start').then((x) => { setD(x); merke('start', x); }).catch(() => undefined);
      if (Date.now() - wetterZeit > 10 * 60000) { // Vorhersage höchstens alle 10 Minuten
        wetterZeit = Date.now();
        ladeWetter().then((w) => { setWetter(w); merke('wetter', w); }).catch(() => undefined);
      }
    };
    laden();
    // Die App bleibt auf dem Handy oft offen: beim Zurückkehren und jede Minute neu laden,
    // damit „am Platz“, Flugleiter und Wetter aktuell sind.
    const sichtbar = () => { if (document.visibilityState === 'visible') laden(); };
    document.addEventListener('visibilitychange', sichtbar);
    const takt = window.setInterval(() => { if (document.visibilityState === 'visible') laden(); }, 60000);
    return () => { document.removeEventListener('visibilitychange', sichtbar); window.clearInterval(takt); };
  }, [s?.token]);

  const termine = (d?.termine ?? []).slice(0, 3);
  // Messwerte der eigenen Station am Platz haben Vorrang, Böen/Regen kommen aus der Vorhersage
  const station = d?.wetterstation?.erreichbar ? d.wetterstation.daten : undefined;
  const windJetzt = station?.wind ?? wetter?.wind;
  const boeen = Math.max(wetter?.boeen ?? 0, station?.wind ?? 0);
  const ampel = wetter || station ? windAmpel(boeen, einstellungen.windGelb, einstellungen.windRot, wetter?.niederschlag ?? 0, wetter?.code ?? 0) : null;
  const b = d?.bluetti?.daten;
  const ichAmPlatz = s ? d?.anwesend.liste?.find((x) => x.mitgliedId === s.mitgliedId) : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-6 pt-4">
      {/* Statuszeile */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Link to="/wetter" className="karte flex items-center gap-3 p-3">
          <span className={klassen('h-3.5 w-3.5 shrink-0 rounded-full', ampel === 'rot' ? 'bg-mgi-rot' : ampel === 'gelb' ? 'bg-sonne' : ampel ? 'bg-emerald-500' : 'bg-slate-300')} aria-hidden />
          <span className="text-sm leading-tight">
            {windJetzt !== undefined && windJetzt !== null ? (
              <>
                <b className="text-base">{Math.round(windJetzt)}</b> km/h {station?.richtung ?? (wetter ? himmelsrichtung(wetter.richtung) : '')}
                <span className="block text-slate-500">
                  {wetter ? `Böen ${Math.round(wetter.boeen)} · ` : ''}{Math.round((station?.temperatur ?? wetter?.temperatur) ?? 0)} °C{station ? ' · Station' : ''}
                </span>
              </>
            ) : (
              <span className="text-slate-500">Wetter lädt …</span>
            )}
          </span>
        </Link>
        <Link to="/flugbuch" className="karte flex items-center gap-3 p-3">
          <Icon name="personen" className="h-6 w-6 shrink-0 text-himmel-600" />
          <span className="text-sm leading-tight">
            <b className="text-base">{d?.anwesend.anzahl ?? '–'}</b> am Platz
            <span className="block text-slate-500">{d?.anwesend.flugleiter ? 'Flugleiter da' : 'kein Flugleiter'}</span>
          </span>
        </Link>
      </div>

      {s && d?.arbeitsdienst?.[0] && <ArbeitsdienstHinweis w={d.arbeitsdienst[0]} />}

      {/* FLUGBUCH – groß und auffällig */}
      <Link to="/flugbuch" className={klassen('mb-4 flex items-center gap-4 rounded-2xl p-5 text-white shadow-lg ring-2 ring-white/40 active:scale-[0.99]',
        ichAmPlatz ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-gradient-to-br from-mgi-rot to-mgi-rot-dunkel')}>
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Icon name="flieger" className="h-10 w-10" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xl font-extrabold tracking-tight">Flugbuch</span>
          <span className="block font-semibold opacity-95">
            {ichAmPlatz
              ? `Du bist seit ${new Date(ichAmPlatz.seit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr angemeldet`
              : 'Jetzt anmelden'}
          </span>
          <span className="block text-sm opacity-90">
            {d ? `${d.anwesend.anzahl} am Platz · ${d.anwesend.flugleiter ? 'Flugleiter da' : 'kein Flugleiter'}` : 'An- und abmelden'}
          </span>
        </span>
        <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-tinte shadow">{ichAmPlatz ? 'Abmelden' : 'Anmelden'}</span>
      </Link>

      {/* Logo & nächste Termine */}
      <div className="karte mb-4 overflow-hidden">
        <div className="flex items-center gap-4 p-4 pb-3">
          <img src="logo-640.jpg" alt="Logo der Modellbau-Gemeinschaft Ismaning e.V." className="h-16 w-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            {s && <p className="text-sm text-slate-500">Hallo {s.name.split(' ')[0]}!</p>}
            <p className="font-bold leading-tight">{config.vereinsname}</p>
          </div>
        </div>
        {termine.length > 0 && (
          <Link to="/kalender" className="block border-t border-himmel-100 px-4 pb-3 pt-2 dark:border-slate-700">
            <span className="text-xs font-bold uppercase tracking-wide text-mgi-rot">Nächste Termine</span>
            <ul className="mt-1 divide-y divide-himmel-100 dark:divide-slate-700">
              {termine.map((t, i) => (
                <li key={t.beginn + i} className="flex items-baseline gap-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{t.titel}</span>
                    <span className="block text-sm text-slate-600 dark:text-slate-400">{terminDatum(t.beginn, t.ganztaegig, t.ende)}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-himmel-100 px-2 py-0.5 text-xs font-semibold text-himmel-700 dark:bg-slate-800 dark:text-himmel-300">{tageBis(t.beginn)}</span>
                </li>
              ))}
            </ul>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Kachel zu="/kalender" icon="kalender" titel="Termine">Alle kommenden Termine</Kachel>
        <Kachel zu="/wetter" icon="wind" titel="Wetter">
          {ampel === 'rot' ? 'Zu viel Wind' : ampel === 'gelb' ? 'Wind beachten' : 'Wind & Vorhersage'}
        </Kachel>
        <Link to="/webcam" className="karte relative col-span-2 block h-40 overflow-hidden bg-gradient-to-br from-himmel-200 to-himmel-500">
          <Icon name="webcam" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/70" />
          <img src={`${config.webcam.snapshotUrl}&t=${Math.floor(Date.now() / 60000)}`} alt="Aktuelles Webcam-Bild vom Flugplatz" className="relative h-full w-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 font-bold text-white">
            <Icon name="webcam" /> Webcam Flugplatz
          </span>
        </Link>
        <Link to="/strom" className="karte flex min-h-32 items-center gap-3 p-4">
          <AkkuRing prozent={b?.soc ?? null} groesse={64} />
          <span>
            <span className="block font-bold">Strom</span>
            <span className="block text-sm text-slate-600 dark:text-slate-400">
              {!d?.bluetti ? 'Bluetti' : b ? `☀ ${b.solar_input_w} W` : 'nicht erreichbar'}
            </span>
          </span>
        </Link>
        <Kachel zu="/foto" icon="kamera" titel="Foto aufnehmen" farbe="rot">Direkt auf die Homepage</Kachel>
        <Kachel zu="/wettbewerbe" icon="pokal" titel="Wettbewerbe" farbe="gelb">Ergebnisse & Wertung</Kachel>
        <Kachel zu="/brett" icon="pinnwand" titel="Schwarzes Brett">Biete · Suche · Info</Kachel>
        <Kachel zu="/arbeitsdienst" icon="schaufel" titel="Arbeitsdienst">Termine & Eintragen</Kachel>
        <Kachel zu="/technik" icon="zahnrad" titel="Technik am Platz">Wetterstation, Walze, Strom …</Kachel>
        <Kachel zu="/regeln" icon="sprechblase" titel="Regel-Assistent (KI)" breit>Fragen zu Satzung & Flugbetriebsordnung</Kachel>
        <Kachel zu="/notfall" icon="notfall" titel="Platzordnung & Notfall" farbe="rot" breit>Notruf 112, Anfahrt, Regeln</Kachel>
      </div>
    </div>
  );
}
