import { useEffect, useRef, useState } from 'react';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Fehler, Hinweis, Knopf, Seite } from '../components/ui';
import { api } from '../lib/api';
import { klassen, markdown } from '../lib/helfer';

/** Regel-Assistent: KI beantwortet Fragen zu Satzung und Flugbetriebsordnung (Backend: Google Gemini) */

interface Nachricht { rolle: 'ich' | 'ki'; text: string }
interface Antwort { antwort: string; dokumente: string[]; uebrig: number }

const KEY = 'mgi.regeln-verlauf';
const BEISPIELE = [
  'Wann darf ich mit Verbrennern fliegen?',
  'Wie hoch darf ich fliegen?',
  'Wann muss ein Flugleiter anwesend sein?',
  'Wie kann ich aus dem Verein austreten?',
  'Was muss ein Gastpilot vor dem Fliegen tun?',
];

function Inhalt() {
  const [verlauf, setVerlauf] = useState<Nachricht[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as Nachricht[]; } catch { return []; }
  });
  const [frage, setFrage] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');
  const [info, setInfo] = useState<{ dokumente: string[]; uebrig: number } | null>(null);
  const ende = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(verlauf.slice(-20))); } catch { /* egal */ }
    ende.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [verlauf, laedt]);

  async function senden(text: string) {
    const f = text.trim();
    if (!f || laedt) return;
    setFehler('');
    setFrage('');
    const vorher = verlauf;
    setVerlauf([...vorher, { rolle: 'ich', text: f }]);
    setLaedt(true);
    try {
      const r = await api<Antwort>('regeln_frage', { frage: f, verlauf: vorher.slice(-6) });
      setVerlauf((v) => [...v, { rolle: 'ki', text: r.antwort }]);
      setInfo({ dokumente: r.dokumente, uebrig: r.uebrig });
    } catch (e) {
      setFehler((e as Error).message);
      setVerlauf(vorher);
      setFrage(f);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="space-y-4">
      <Hinweis>
        Stell eine Frage zur <b>Vereinssatzung</b>, zur <b>Flugbetriebsordnung</b> oder zu den <b>MFSD-Regeln (StRfF)</b>. Die Antwort kommt von einer KI (Google Gemini) und nur aus diesen Regelwerken –
        <b> ohne Gewähr</b>. Damit sie konkret antworten kann, kennt sie die aktuelle Lage am Platz (Uhrzeit, Sonnenuntergang, Wind, Anwesende) und ob du im Flugbuch angemeldet bist – aber nicht deinen Namen. Maßgeblich ist immer der Originaltext; im Zweifel entscheidet der Vorstand.
      </Hinweis>

      {verlauf.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Zum Beispiel:</p>
          <div className="flex flex-wrap gap-2">
            {BEISPIELE.map((b) => (
              <button key={b} type="button" onClick={() => void senden(b)}
                className="rounded-full border border-himmel-200 bg-white px-3 py-1.5 text-sm text-himmel-700 hover:bg-himmel-50 dark:border-slate-600 dark:bg-slate-800 dark:text-himmel-300">
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {verlauf.map((m, i) => (
          <div key={i} className={klassen('flex', m.rolle === 'ich' ? 'justify-end' : 'justify-start')}>
            {m.rolle === 'ich' ? (
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-himmel-600 px-4 py-2.5 text-white">{m.text}</div>
            ) : (
              <div className="karte max-w-[90%] rounded-bl-sm px-4 py-3">
                <div className="md text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: markdown(m.text) }} />
              </div>
            )}
          </div>
        ))}
        {laedt && (
          <div className="flex justify-start">
            <div className="karte px-4 py-3 text-slate-500"><span className="inline-block animate-pulse">Ich schaue in Satzung, Flugbetriebsordnung und StRfF …</span></div>
          </div>
        )}
      </div>

      {fehler && <Fehler fehler={fehler} />}

      <form className="karte flex items-end gap-2 p-2" onSubmit={(e) => { e.preventDefault(); void senden(frage); }}>
        <textarea
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void senden(frage); } }}
          rows={Math.min(4, Math.max(1, frage.split('\n').length))}
          maxLength={600}
          placeholder="Deine Frage …"
          aria-label="Frage an den Regel-Assistenten"
          className="min-h-11 flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2.5 text-base outline-none focus:ring-0"
        />
        <Knopf type="submit" laedt={laedt} disabled={!frage.trim()} aria-label="Frage senden"><Icon name="rechts" className="h-5 w-5" /></Knopf>
      </form>

      <div ref={ende} className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{info ? `Quellen: ${info.dokumente.join(', ')} · heute noch ${info.uebrig} Fragen` : 'Bis zu 30 Fragen pro Tag'}</span>
        {verlauf.length > 0 && (
          <button type="button" className="underline" onClick={() => { setVerlauf([]); setInfo(null); setFehler(''); }}>Neues Gespräch</button>
        )}
      </div>
    </div>
  );
}

export default function Regeln() {
  return (
    <Seite titel="Regel-Assistent">
      <NurMitglied text="Der Regel-Assistent ist nur für Mitglieder."><Inhalt /></NurMitglied>
    </Seite>
  );
}
