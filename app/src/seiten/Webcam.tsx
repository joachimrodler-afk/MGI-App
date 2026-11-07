import { useEffect, useState } from 'react';
import { Seite } from '../components/ui';
import { config } from '../config';

/**
 * Webcam: Das Live-Video läuft auf der Seite von IPCamLive.
 * Im kostenlosen IPCamLive-Paket lässt sich der Player nicht einbetten, und die Tapo-Kamera
 * liefert selbst kein Standbild. Läuft der Stream gerade (weil jemand zuschaut), zeigt die App
 * zusätzlich das aktuelle Standbild – sonst nur den Knopf zum Live-Video.
 */
export default function Webcam() {
  const [bild, setBild] = useState('');

  useEffect(() => {
    const holen = () => {
      const url = `${config.webcam.snapshotUrl}&t=${Date.now()}`;
      const img = new Image();
      img.onload = () => setBild(url);
      img.onerror = () => setBild('');
      img.src = url;
    };
    holen();
    const t = setInterval(() => { if (!document.hidden) holen(); }, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <Seite titel="Webcam Flugplatz">
      <a href={config.webcam.seite} target="_blank" rel="noopener noreferrer"
        className="karte relative block aspect-video w-full overflow-hidden bg-gradient-to-br from-himmel-300 to-himmel-700 active:scale-[0.99]"
        aria-label="Live-Video der Webcam bei IPCamLive öffnen">
        {bild && <img src={bild} alt="Aktuelles Bild der Webcam" className="absolute inset-0 h-full w-full object-cover" />}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 text-white">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mgi-rot shadow-lg">
            <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" fill="currentColor" aria-hidden><path d="M7 4v16l13-8z" /></svg>
          </span>
          <span className="text-lg font-bold drop-shadow">Live-Video öffnen</span>
        </span>
      </a>
      <p className="mt-3 text-sm text-slate-500">
        Das Live-Video der Kamera am Platz läuft bei IPCamLive und öffnet sich in einem neuen Fenster. Mit „Zurück“ bist du wieder in der App.
      </p>
    </Seite>
  );
}
