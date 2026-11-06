import { Icon } from '../components/Icon';
import { ExternerLink, Fehler, Laden, Seite, useLaden } from '../components/ui';
import { config } from '../config';
import { api, erinnere, merke } from '../lib/api';
import { useEinstellungen } from '../lib/einstellungen';
import { klassen, uhrzeit, vorZeit } from '../lib/helfer';
import type { WetterstationAntwort } from '../lib/model';
import { himmelsrichtung, ladeWetter, wetterText, windAmpel, type WetterJetzt } from '../lib/wetter';

const GRAD: Record<string, number> = { N: 0, NO: 45, O: 90, SO: 135, S: 180, SW: 225, W: 270, NW: 315 };

function Kompass({ grad, label }: { grad: number; label: string }) {
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label={`Wind aus ${label}`}>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" className="text-himmel-200 dark:text-slate-700" />
      {['N', 'O', 'S', 'W'].map((r, i) => (
        <text key={r} x={50 + 38 * Math.sin((i * Math.PI) / 2)} y={50 - 38 * Math.cos((i * Math.PI) / 2)} textAnchor="middle" dominantBaseline="central"
          fontSize="11" fontWeight="700" fill="currentColor" className="text-slate-500">{r}</text>
      ))}
      {/* Pfeil zeigt, wohin der Wind weht (Windrichtung = woher er kommt) */}
      <g transform={`rotate(${grad + 180} 50 50)`}>
        <path d="M50 22 L58 42 L52 40 L52 74 L48 74 L48 40 L42 42 Z" fill="#d7262b" />
      </g>
    </svg>
  );
}

export default function Wetter() {
  const { einstellungen: e } = useEinstellungen();
  const vorhersage = useLaden(async () => {
    try {
      const x = await ladeWetter();
      merke('wetter', x);
      return x;
    } catch (err) {
      const alt = erinnere<WetterJetzt>('wetter');
      if (alt) return alt;
      throw err;
    }
  });
  const station = useLaden(() => api<WetterstationAntwort>('wetterstation'));
  const w = vorhersage.daten;
  const st = station.daten?.daten;
  const neu = () => { void vorhersage.neu(); void station.neu(); };

  // Ampel: stärkster Wert aus Stationsmessung und vorhergesagten Böen
  const boeen = Math.max(w?.boeen ?? 0, station.daten?.erreichbar ? st?.wind ?? 0 : 0);
  const ampel = w || st ? windAmpel(boeen, e.windGelb, e.windRot, w?.niederschlag ?? 0, w?.code ?? 0) : null;
  const ampelText = { gruen: '', gelb: 'Wind/Wetter beachten', rot: 'Zu viel Wind – Flugbetrieb kritisch' };
  const ampelFarbe = { gruen: 'bg-emerald-500 text-white', gelb: 'bg-sonne text-tinte', rot: 'bg-mgi-rot text-white' };

  return (
    <Seite titel="Wetter am Platz" aktion={<button onClick={neu} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-himmel-100 dark:hover:bg-slate-800" aria-label="Aktualisieren"><Icon name="aktualisieren" /></button>}>
      <div className="space-y-4">
        {ampel && ampel !== 'gruen' && <div className={klassen('rounded-2xl p-4 text-center text-lg font-bold shadow', ampelFarbe[ampel])}>{ampelText[ampel]}</div>}

        {/* Eigene Wetterstation am Platz */}
        <div className="karte p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Wetterstation am Platz</h2>
            {station.daten && (
              <span className={klassen('rounded-full px-2.5 py-0.5 text-xs font-bold', station.daten.erreichbar ? 'bg-emerald-100 text-emerald-800' : 'bg-sonne-hell text-amber-900')}>
                {station.daten.erreichbar ? 'live' : 'offline'}
              </span>
            )}
          </div>
          {station.laedt && !station.daten && <Laden />}
          {station.fehler && <Fehler fehler={station.fehler} nochmal={station.neu} />}
          {station.daten && !st && <p className="text-sm text-slate-500">Die Wetterstation ist gerade nicht erreichbar.</p>}
          {st && (
            <>
              <div className="grid grid-cols-[auto_1fr] items-center gap-5">
                <Kompass grad={GRAD[st.richtung ?? ''] ?? 0} label={st.richtung ?? '?'} />
                <div>
                  <p className="text-4xl font-extrabold">{st.wind ?? '–'} <span className="text-lg font-semibold">km/h</span></p>
                  <p className="text-slate-600 dark:text-slate-400">aus {st.richtung ?? '–'}</p>
                  <p className="mt-1 text-2xl font-bold">{st.temperatur ?? '–'} °C</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-himmel-50 p-2 dark:bg-slate-800"><p className="font-bold">{st.luftfeuchte ?? '–'} %</p><p className="text-xs text-slate-500">Luftfeuchte</p></div>
                <div className="rounded-xl bg-himmel-50 p-2 dark:bg-slate-800"><p className="font-bold">{st.luftdruck ?? '–'}</p><p className="text-xs text-slate-500">hPa</p></div>
                <div className="rounded-xl bg-himmel-50 p-2 dark:bg-slate-800"><p className="font-bold">{st.batterie ?? '–'} V</p><p className="text-xs text-slate-500">Batterie</p></div>
              </div>
              {station.daten?.zeit && (
                <p className="mt-2 text-xs text-slate-500">{station.daten.erreichbar ? `Messung ${uhrzeit(station.daten.zeit)} Uhr` : `Letzter Wert ${vorZeit(station.daten.zeit)}`}</p>
              )}
            </>
          )}
        </div>

        {/* Vorhersage */}
        {vorhersage.laedt && !w && <Laden />}
        {vorhersage.fehler && <Fehler fehler={vorhersage.fehler} nochmal={vorhersage.neu} />}
        {w && (
          <>
            <div className="karte p-4">
              <h2 className="mb-2 font-bold">Vorhersage</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-himmel-50 p-2 dark:bg-slate-800"><p className="font-bold">{Math.round(w.boeen)} km/h</p><p className="text-xs text-slate-500">Böen jetzt</p></div>
                <div className="rounded-xl bg-himmel-50 p-2 dark:bg-slate-800"><p className="font-bold">{wetterText(w.code)}</p><p className="text-xs text-slate-500">{w.niederschlag} mm Regen</p></div>
                <div className="rounded-xl bg-himmel-50 p-2 dark:bg-slate-800"><p className="font-bold">{w.sonnenuntergang ? w.sonnenuntergang.slice(11, 16) : '–'}</p><p className="text-xs text-slate-500">Sonnenuntergang</p></div>
              </div>
              <h3 className="mb-2 mt-4 text-sm font-semibold">Nächste Stunden (Wind, Böen, Regen)</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {w.stunden.map((s) => {
                  const a = windAmpel(s.boeen, e.windGelb, e.windRot);
                  return (
                    <div key={s.zeit} className="min-w-16 rounded-xl bg-himmel-50 p-2 text-center text-sm dark:bg-slate-800">
                      <p className="font-semibold">{s.zeit.slice(11, 13)} Uhr</p>
                      <p className="text-lg font-bold">{Math.round(s.wind)}</p>
                      <p className={klassen('rounded text-xs font-semibold', a === 'rot' ? 'text-mgi-rot' : a === 'gelb' ? 'text-amber-600' : 'text-slate-500')}>B {Math.round(s.boeen)}</p>
                      <p className="text-xs text-himmel-700 dark:text-himmel-300">{s.regenWkt}% ☂</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-center text-xs text-slate-500">
              Messwerte: MGI-Wetterstation · Vorhersage: Open-Meteo ({himmelsrichtung(w.richtung)}) · Ampel: ab {e.windGelb} km/h gelb, ab {e.windRot} km/h rot
            </p>
          </>
        )}

        <ExternerLink href={config.wetter.stationUrl}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-himmel-700 ring-1 ring-himmel-300 dark:bg-slate-800 dark:text-himmel-200">
          <Icon name="extern" className="h-5 w-5" /> Verlauf bei Wettermonster
        </ExternerLink>
      </div>
    </Seite>
  );
}
