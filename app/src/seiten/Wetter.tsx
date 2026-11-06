import { Icon } from '../components/Icon';
import { ExternerLink, Fehler, Laden, Seite, useLaden } from '../components/ui';
import { config } from '../config';
import { erinnere, merke } from '../lib/api';
import { useEinstellungen } from '../lib/einstellungen';
import { klassen, uhrzeit } from '../lib/helfer';
import { himmelsrichtung, ladeWetter, wetterText, windAmpel, type WetterJetzt } from '../lib/wetter';

export default function Wetter() {
  const { einstellungen: e } = useEinstellungen();
  const { daten: w, fehler, laedt, neu } = useLaden(async () => {
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
  const ampel = w ? windAmpel(w.boeen, e.windGelb, e.windRot, w.niederschlag, w.code) : null;
  const ampelText = { gruen: 'Gutes Flugwetter', gelb: 'Wind/Wetter beachten', rot: 'Zu viel Wind – Flugbetrieb kritisch' };
  const ampelFarbe = { gruen: 'bg-emerald-500 text-white', gelb: 'bg-sonne text-tinte', rot: 'bg-mgi-rot text-white' };

  return (
    <Seite titel="Wetter am Platz" aktion={<button onClick={neu} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-himmel-100 dark:hover:bg-slate-800" aria-label="Aktualisieren"><Icon name="aktualisieren" /></button>}>
      {laedt && !w && <Laden />}
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      {w && ampel && (
        <div className="space-y-4">
          <div className={klassen('rounded-2xl p-4 text-center text-lg font-bold shadow', ampelFarbe[ampel])}>{ampelText[ampel]}</div>
          <div className="karte grid grid-cols-[auto_1fr] items-center gap-5 p-5">
            <div className="relative h-28 w-28">
              <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`Wind aus ${himmelsrichtung(w.richtung)}`}>
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" className="text-himmel-200 dark:text-slate-700" />
                {['N', 'O', 'S', 'W'].map((r, i) => (
                  <text key={r} x={50 + 38 * Math.sin((i * Math.PI) / 2)} y={50 - 38 * Math.cos((i * Math.PI) / 2)} textAnchor="middle" dominantBaseline="central"
                    fontSize="11" fontWeight="700" fill="currentColor" className="text-slate-500">{r}</text>
                ))}
                {/* Pfeil zeigt, wohin der Wind weht (Windrichtung = woher er kommt) */}
                <g transform={`rotate(${w.richtung + 180} 50 50)`}>
                  <path d="M50 22 L58 42 L52 40 L52 74 L48 74 L48 40 L42 42 Z" fill="#d7262b" />
                </g>
              </svg>
            </div>
            <div>
              <p className="text-4xl font-extrabold">{Math.round(w.wind)} <span className="text-lg font-semibold">km/h</span></p>
              <p className="text-slate-600 dark:text-slate-400">aus {himmelsrichtung(w.richtung)} ({Math.round(w.richtung)}°)</p>
              <p className="mt-1 font-semibold">Böen bis {Math.round(w.boeen)} km/h</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="karte p-3"><p className="text-2xl font-bold">{Math.round(w.temperatur)}°</p><p className="text-xs text-slate-500">{wetterText(w.code)}</p></div>
            <div className="karte p-3"><p className="text-2xl font-bold">{w.niederschlag}</p><p className="text-xs text-slate-500">mm Regen</p></div>
            <div className="karte p-3"><p className="text-2xl font-bold">{w.sonnenuntergang ? w.sonnenuntergang.slice(11, 16) : '–'}</p><p className="text-xs text-slate-500">Sonnenuntergang</p></div>
          </div>
          <div className="karte p-4">
            <h2 className="mb-3 font-bold">Nächste Stunden</h2>
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
            Stand {uhrzeit(w.zeit)} Uhr · Daten: Open-Meteo · Ampel: Böen ab {e.windGelb} km/h gelb, ab {e.windRot} km/h rot
          </p>
        </div>
      )}
      <ExternerLink href={config.wetter.stationUrl}
        className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-himmel-700 ring-1 ring-himmel-300 dark:bg-slate-800 dark:text-himmel-200">
        <Icon name="extern" className="h-5 w-5" /> Vereins-Wetterstation (Wettermonster)
      </ExternerLink>
    </Seite>
  );
}
