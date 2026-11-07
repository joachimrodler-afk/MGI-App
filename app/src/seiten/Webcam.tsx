import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Knopf, Seite } from '../components/ui';
import { config } from '../config';
import { klassen } from '../lib/helfer';

/**
 * Webcam: „Fast-Live“ aus Standbildern von IPCamLive, alle paar Sekunden neu geladen.
 * Das nächste Bild wird erst im Hintergrund geladen und dann getauscht – so flackert nichts.
 * Läuft nur, solange die Seite sichtbar ist (spart mobiles Datenvolumen).
 * Den echten Live-Player lässt IPCamLive im kostenlosen Paket nicht einbetten – dafür gibt es den Link.
 */
const INTERVALLE = [3, 5, 10];
const KEY = 'mgi.webcam.intervall';

export default function Webcam() {
  const [intervall, setIntervall] = useState(() => Number(localStorage.getItem(KEY)) || 5);
  const [laeuft, setLaeuft] = useState(true);
  const [bild, setBild] = useState('');
  const [stand, setStand] = useState<number | null>(null);
  const [fehler, setFehler] = useState(false);
  const [sichtbar, setSichtbar] = useState(!document.hidden);
  const rahmen = useRef<HTMLDivElement>(null);
  const laedt = useRef(false);

  function holen() {
    if (laedt.current) return; // vorheriges Bild noch unterwegs – nicht stauen
    laedt.current = true;
    const t = Date.now();
    const url = `${config.webcam.snapshotUrl}&t=${t}`;
    const img = new Image();
    img.onload = () => { laedt.current = false; setBild(url); setStand(t); setFehler(false); };
    img.onerror = () => { laedt.current = false; setFehler(true); };
    img.src = url;
  }

  useEffect(() => {
    const f = () => setSichtbar(!document.hidden);
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  useEffect(() => {
    if (!laeuft || !sichtbar) return;
    holen();
    const t = setInterval(holen, intervall * 1000);
    return () => clearInterval(t);
  }, [laeuft, sichtbar, intervall]);

  function waehle(s: number) {
    setIntervall(s);
    try { localStorage.setItem(KEY, String(s)); } catch { /* egal */ }
  }

  function vollbild() {
    const el = rahmen.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }

  const alter = stand ? Math.max(0, Math.round((Date.now() - stand) / 1000)) : null;

  return (
    <Seite titel="Webcam Flugplatz">
      <div className="karte overflow-hidden">
        <div ref={rahmen} className="relative aspect-video w-full bg-slate-900 [&:fullscreen]:aspect-auto [&:fullscreen]:h-full">
          {bild && <img src={bild} alt="Webcam Flugplatz, laufend aktualisiert" className="h-full w-full object-contain" onDoubleClick={vollbild} />}
          {!bild && !fehler && <span className="absolute inset-0 flex items-center justify-center text-slate-300">Bild lädt …</span>}
          {fehler && !bild && <span className="absolute inset-0 flex items-center justify-center text-slate-300">Webcam gerade nicht erreichbar</span>}
          <span className={klassen('absolute left-2 top-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white',
            laeuft && sichtbar && !fehler ? 'bg-mgi-rot' : 'bg-black/60')}>
            {laeuft && sichtbar && !fehler && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
            {laeuft ? (fehler ? 'Verbindung …' : `LIVE · alle ${intervall} s`) : 'Pause'}
          </span>
          <button onClick={vollbild} className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white" aria-label="Vollbild">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
          {stand && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white tabular-nums">
              {new Date(stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-2">
            <Knopf art={laeuft ? 'sekundaer' : 'primaer'} className="!min-h-10 flex-1 text-sm" onClick={() => setLaeuft(!laeuft)}>
              {laeuft ? 'Pause' : 'Weiter'}
            </Knopf>
            <div className="flex flex-1 gap-1 rounded-xl bg-himmel-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Aktualisieren alle">
              {INTERVALLE.map((s) => (
                <button key={s} role="radio" aria-checked={intervall === s} onClick={() => waehle(s)}
                  className={klassen('min-h-8 flex-1 rounded-lg text-sm font-semibold', intervall === s ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300')}>
                  {s} s
                </button>
              ))}
            </div>
          </div>
          {alter !== null && alter > intervall * 4 && laeuft && (
            <p className="text-xs text-amber-700 dark:text-amber-300">Letztes Bild ist {alter} s alt – die Verbindung ist gerade langsam.</p>
          )}
          <a href={config.webcam.seite} target="_blank" rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-himmel-100 text-sm font-semibold text-himmel-700 dark:bg-slate-800 dark:text-himmel-200">
            <Icon name="extern" className="h-4 w-4" /> Echtes Video bei IPCamLive öffnen
          </a>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Die App lädt das Kamerabild alle paar Sekunden neu – ohne Ton und ohne flüssige Bewegung. Im Hintergrund pausiert es automatisch.
        Unterwegs ohne WLAN lieber 10 s wählen, das spart Datenvolumen.
      </p>
    </Seite>
  );
}
