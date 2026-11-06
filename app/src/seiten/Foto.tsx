import { useEffect, useRef, useState } from 'react';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Feld, Hinweis, Knopf, Seite } from '../components/ui';
import { useEinstellungen } from '../lib/einstellungen';
import { fotoEinreihen, fotoEntfernen, hochladen, warteschlange, type WarteFoto } from '../lib/fotos';
import { bildVerkleinern, klassen } from '../lib/helfer';
import { useOnline } from '../lib/sitzung';

const KATEGORIEN = ['Flugtag', 'Wettbewerb', 'Schiffsmodell', 'Arbeitsdienst', 'Sonstiges'];

interface Auswahl { vorschau: string; base64: string; aufgenommen: string }

function FotoInhalt() {
  const { einstellungen } = useEinstellungen();
  const online = useOnline();
  const kamera = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);
  const [auswahl, setAuswahl] = useState<Auswahl[]>([]);
  const [kategorie, setKategorie] = useState('Flugtag');
  const [titel, setTitel] = useState('');
  const [bearbeite, setBearbeite] = useState(false);
  const [fortschritt, setFortschritt] = useState<[number, number] | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler' | 'info'; text: string } | null>(null);
  const [wartend, setWartend] = useState<WarteFoto[]>([]);

  useEffect(() => {
    const f = () => void warteschlange().then(setWartend);
    f();
    window.addEventListener('mgi-fotos', f);
    return () => window.removeEventListener('mgi-fotos', f);
  }, []);

  async function gewaehlt(dateien: FileList | null) {
    if (!dateien?.length) return;
    setBearbeite(true);
    setMeldung(null);
    try {
      const neu: Auswahl[] = [];
      for (const d of Array.from(dateien).slice(0, 20)) {
        const { base64, vorschau } = await bildVerkleinern(d);
        neu.push({ base64, vorschau, aufgenommen: new Date(d.lastModified || Date.now()).toISOString() });
      }
      setAuswahl((a) => [...a, ...neu]);
    } catch {
      setMeldung({ art: 'fehler', text: 'Das Bild konnte nicht gelesen werden.' });
    } finally {
      setBearbeite(false);
      if (kamera.current) kamera.current.value = '';
      if (galerie.current) galerie.current.value = '';
    }
  }

  async function senden() {
    for (const a of auswahl) {
      await fotoEinreihen({ base64: a.base64, kategorie, titel, aufgenommen: a.aufgenommen });
    }
    const anzahl = auswahl.length;
    setAuswahl([]);
    setTitel('');
    if (!online) {
      setMeldung({ art: 'info', text: `${anzahl} Foto(s) gespeichert. Sie werden automatisch hochgeladen, sobald du wieder Netz hast.` });
      return;
    }
    const ok = await hochladen((f, g) => setFortschritt([f, g]));
    setFortschritt(null);
    const rest = (await warteschlange()).length;
    setMeldung(rest
      ? { art: 'fehler', text: `${ok} hochgeladen, ${rest} warten noch – es wird später automatisch erneut versucht.` }
      : { art: 'ok', text: `${ok} Foto(s) hochgeladen – sie erscheinen in Kürze auf der Homepage.` });
  }

  return (
    <div className="space-y-4">
      <input ref={kamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => gewaehlt(e.target.files)} />
      <input ref={galerie} type="file" accept="image/*" multiple className="hidden" onChange={(e) => gewaehlt(e.target.files)} />

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => kamera.current?.click()} className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-mgi-rot font-bold text-white shadow-md active:scale-[0.98]">
          <Icon name="kamera" className="h-10 w-10" /> Foto aufnehmen
        </button>
        <button onClick={() => galerie.current?.click()} className="karte flex min-h-32 flex-col items-center justify-center gap-2 font-bold text-himmel-700 active:scale-[0.98] dark:text-himmel-200">
          <Icon name="hochladen" className="h-10 w-10" /> Aus Galerie
        </button>
      </div>

      {bearbeite && <Hinweis>Bilder werden vorbereitet …</Hinweis>}

      {auswahl.length > 0 && (
        <div className="karte space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2">
            {auswahl.map((a, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
                <img src={a.vorschau} alt={`Vorschau ${i + 1}`} className="h-full w-full object-cover" />
                <button onClick={() => setAuswahl((x) => x.filter((_, j) => j !== i))} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Foto entfernen">
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div>
            <span className="label">Kategorie</span>
            <div className="flex flex-wrap gap-2">
              {KATEGORIEN.map((k) => (
                <button key={k} onClick={() => setKategorie(k)} className={klassen('min-h-10 rounded-full px-4 text-sm font-semibold',
                  kategorie === k ? 'bg-himmel-600 text-white' : 'bg-himmel-100 text-himmel-800 dark:bg-slate-800 dark:text-himmel-200')}>{k}</button>
              ))}
            </div>
          </div>
          <Feld label="Titel / Kommentar (optional)">
            <input className="eingabe" value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={60} placeholder="z. B. Erstflug Segler" />
          </Feld>
          {einstellungen.datenschutzFoto && <Hinweis art="warnung">{einstellungen.datenschutzFoto}</Hinweis>}
          <Knopf onClick={senden} className="w-full" laedt={!!fortschritt}>
            <Icon name="hochladen" className="h-5 w-5" /> {auswahl.length} Foto{auswahl.length > 1 ? 's' : ''} hochladen
          </Knopf>
        </div>
      )}

      {fortschritt && (
        <div className="karte p-4">
          <p className="mb-2 text-sm font-semibold">Hochladen {Math.min(fortschritt[0] + 1, fortschritt[1])} von {fortschritt[1]} …</p>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full bg-himmel-600 transition-all" style={{ width: `${(fortschritt[0] / Math.max(1, fortschritt[1])) * 100}%` }} />
          </div>
        </div>
      )}

      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}

      {wartend.length > 0 && !fortschritt && (
        <div className="karte p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Warten auf Upload ({wartend.length})</h2>
            <Knopf art="leise" onClick={() => void hochladen().then(() => undefined)} disabled={!online}>Jetzt senden</Knopf>
          </div>
          <ul className="space-y-1 text-sm">
            {wartend.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{w.kategorie}{w.titel ? ` – ${w.titel}` : ''}{w.fehler ? <span className="text-mgi-rot"> · {w.fehler}</span> : null}</span>
                <button onClick={() => fotoEntfernen(w.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-red-50" aria-label="Aus Warteschlange entfernen">
                  <Icon name="muell" className="h-4 w-4 text-mgi-rot" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-center text-xs text-slate-500">Bilder werden vor dem Hochladen verkleinert (max. 2000 Pixel), um mobile Daten zu sparen.</p>
    </div>
  );
}

export default function Foto() {
  return (
    <Seite titel="Foto für die Homepage" zurueck={false}>
      <NurMitglied text="Zum Hochladen von Fotos bitte anmelden.">
        <FotoInhalt />
      </NurMitglied>
    </Seite>
  );
}
