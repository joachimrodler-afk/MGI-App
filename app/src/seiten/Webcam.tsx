import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { ExternerLink, Knopf, Seite } from '../components/ui';
import { config } from '../config';

export default function Webcam() {
  const [stand, setStand] = useState(Date.now());
  const [live, setLive] = useState(false);
  const [bildFehler, setBildFehler] = useState(false);

  useEffect(() => {
    if (live) return;
    const t = setInterval(() => setStand(Date.now()), config.webcam.aktualisierenSek * 1000);
    return () => clearInterval(t);
  }, [live]);

  return (
    <Seite titel="Webcam Flugplatz">
      <div className="karte overflow-hidden">
        {live ? (
          <div className="relative aspect-video bg-black">
            <iframe src={config.webcam.playerUrl} title="Live-Stream der Flugplatz-Webcam" className="absolute inset-0 h-full w-full" allow="autoplay; fullscreen" allowFullScreen />
          </div>
        ) : (
          <button onClick={() => setLive(true)} className="group relative block aspect-video w-full bg-slate-900" aria-label="Live-Stream starten">
            {!bildFehler ? (
              <img src={`${config.webcam.snapshotUrl}&t=${stand}`} alt="Aktuelles Standbild der Webcam" className="h-full w-full object-cover"
                onError={() => setBildFehler(true)} onLoad={() => setBildFehler(false)} />
            ) : (
              <span className="flex h-full items-center justify-center text-slate-300">Standbild nicht verfügbar</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mgi-rot/90 text-white shadow-lg transition group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" fill="currentColor" aria-hidden><path d="M7 4v16l13-8z" /></svg>
              </span>
            </span>
          </button>
        )}
        <div className="flex items-center justify-between gap-2 p-3 text-sm">
          <span className="text-slate-500">{live ? 'Live-Stream' : `Standbild ${new Date(stand).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} Uhr`}</span>
          {live ? (
            <Knopf art="leise" onClick={() => setLive(false)}>Stoppen</Knopf>
          ) : (
            <Knopf art="leise" onClick={() => setStand(Date.now())}><Icon name="aktualisieren" className="h-5 w-5" /> Aktualisieren</Knopf>
          )}
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">Der Live-Stream startet erst nach dem Antippen – das spart mobile Daten.</p>
      <ExternerLink href={config.webcam.seite}
        className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-himmel-700 ring-1 ring-himmel-300 dark:bg-slate-800 dark:text-himmel-200">
        <Icon name="extern" className="h-5 w-5" /> Webcam bei IPCamLive öffnen
      </ExternerLink>
    </Seite>
  );
}
