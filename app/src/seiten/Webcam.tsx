import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Knopf, Seite } from '../components/ui';
import { config } from '../config';

/**
 * Webcam: Standbild (minütlich aktualisiert). Der Live-Stream läuft auf der IPCamLive-Seite,
 * weil sich der Player im kostenlosen IPCamLive-Paket nicht in andere Seiten einbetten lässt.
 */
export default function Webcam() {
  const [stand, setStand] = useState(Date.now());
  const [bildFehler, setBildFehler] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setStand(Date.now()), config.webcam.aktualisierenSek * 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <Seite titel="Webcam Flugplatz">
      <div className="karte overflow-hidden">
        <a href={config.webcam.seite} target="_blank" rel="noopener noreferrer" className="group relative block aspect-video w-full bg-slate-900" aria-label="Live-Stream bei IPCamLive öffnen">
          {!bildFehler ? (
            <img src={`${config.webcam.snapshotUrl}&t=${stand}`} alt="Aktuelles Standbild der Webcam" className="h-full w-full object-cover"
              onError={() => setBildFehler(true)} onLoad={() => setBildFehler(false)} />
          ) : (
            <span className="flex h-full items-center justify-center text-slate-300">Standbild gerade nicht verfügbar</span>
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mgi-rot shadow">
              <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden><path d="M7 4v16l13-8z" /></svg>
            </span>
            Live-Stream öffnen
          </span>
        </a>
        <div className="flex items-center justify-between gap-2 p-3 text-sm">
          <span className="text-slate-500">Standbild {new Date(stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr</span>
          <Knopf art="leise" onClick={() => setStand(Date.now())}><Icon name="aktualisieren" className="h-5 w-5" /> Aktualisieren</Knopf>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">Das Standbild aktualisiert sich jede Minute. Der Live-Stream öffnet sich auf der Seite von IPCamLive.</p>
    </Seite>
  );
}
