import { useRef, useState } from 'react';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Laden, Leer, Seite, useLaden } from '../components/ui';
import { api } from '../lib/api';
import { bildVerkleinern, datumKurz, klassen } from '../lib/helfer';
import type { BrettBeitrag } from '../lib/model';
import { useSitzung } from '../lib/sitzung';

type Kat = BrettBeitrag['kategorie'];
const KAT: Record<Kat, { name: string; farbe: string }> = {
  biete: { name: 'Biete', farbe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  suche: { name: 'Suche', farbe: 'bg-sonne-hell text-amber-900 dark:bg-amber-950 dark:text-amber-100' },
  info: { name: 'Info', farbe: 'bg-himmel-100 text-himmel-800 dark:bg-himmel-900 dark:text-himmel-100' },
};

type KontaktArt = 'tel' | 'wa' | 'mail';
function kontaktZerlegen(k = ''): { art: KontaktArt; wert: string } {
  const m = /^(tel|wa|mail):(.*)$/.exec(k);
  return m ? { art: m[1] as KontaktArt, wert: m[2] } : { art: 'tel', wert: k.replace(/^Telefon:\s*/, '') };
}
function kontaktLink(k: string) {
  const { art, wert } = kontaktZerlegen(k);
  const nr = wert.replace(/[^\d+]/g, '');
  if (art === 'mail') return { href: `mailto:${wert}`, text: 'E-Mail schreiben', icon: 'extern' };
  if (art === 'wa') return { href: `https://wa.me/${nr.replace(/^\+/, '').replace(/^0/, '49')}`, text: 'WhatsApp', icon: 'extern' };
  return { href: `tel:${nr}`, text: 'Anrufen', icon: 'telefon' };
}

function Formular({ alt, fertig }: { alt?: BrettBeitrag; fertig: () => void }) {
  const k0 = kontaktZerlegen(alt?.kontakt);
  const [kategorie, setKategorie] = useState<Kat>(alt?.kategorie ?? 'biete');
  const [titel, setTitel] = useState(alt?.titel ?? '');
  const [text, setText] = useState(alt?.text ?? '');
  const [preis, setPreis] = useState(alt?.preis ?? '');
  const [kArt, setKArt] = useState<KontaktArt>(k0.art);
  const [kWert, setKWert] = useState(k0.wert);
  const [fotos, setFotos] = useState<string[]>(alt?.fotos ?? []);
  const [neu, setNeu] = useState<{ b64: string; vorschau: string }[]>([]);
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function bilder(f: FileList | null) {
    if (!f) return;
    const platz = 3 - fotos.length - neu.length;
    const liste: { b64: string; vorschau: string }[] = [];
    for (const d of Array.from(f).slice(0, platz)) {
      const { base64, vorschau } = await bildVerkleinern(d, 1200, 0.8);
      liste.push({ b64: base64, vorschau });
    }
    setNeu((n) => [...n, ...liste]);
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true);
    setFehler('');
    try {
      await api('brett_speichern', {
        id: alt?.id, kategorie, titel, text, preis, kontakt: kWert ? `${kArt}:${kWert}` : '',
        neueFotos: neu.map((n) => n.b64), entfernteFotos: (alt?.fotos ?? []).filter((f) => !fotos.includes(f)),
      });
      fertig();
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <form onSubmit={speichern} className="karte space-y-4 p-4">
      <h2 className="text-lg font-bold">{alt ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}</h2>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(KAT) as Kat[]).map((k) => (
          <button type="button" key={k} onClick={() => setKategorie(k)} className={klassen('min-h-11 rounded-xl font-semibold', kategorie === k ? 'bg-himmel-600 text-white' : 'bg-himmel-100 dark:bg-slate-800')}>
            {KAT[k].name}
          </button>
        ))}
      </div>
      <Feld label="Titel"><input className="eingabe" value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={80} /></Feld>
      <Feld label="Beschreibung"><textarea className="eingabe min-h-28" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} /></Feld>
      {kategorie !== 'info' && <Feld label="Preis (optional)"><input className="eingabe" value={preis} onChange={(e) => setPreis(e.target.value)} maxLength={30} placeholder="z. B. 50 € oder VB" /></Feld>}
      <div>
        <span className="label">Kontakt (optional – nur angeben, was du teilen möchtest)</span>
        <div className="flex gap-2">
          <select className="eingabe w-36" value={kArt} onChange={(e) => setKArt(e.target.value as KontaktArt)} aria-label="Kontaktart">
            <option value="tel">Telefon</option>
            <option value="wa">WhatsApp</option>
            <option value="mail">E-Mail</option>
          </select>
          <input className="eingabe flex-1" value={kWert} onChange={(e) => setKWert(e.target.value)} inputMode={kArt === 'mail' ? 'email' : 'tel'} aria-label="Kontakt" />
        </div>
      </div>
      <div>
        <span className="label">Fotos (max. 3)</span>
        <div className="flex flex-wrap gap-2">
          {fotos.map((f) => (
            <div key={f} className="relative h-20 w-20 overflow-hidden rounded-xl">
              <img src={f} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setFotos((x) => x.filter((y) => y !== f))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white" aria-label="Foto entfernen"><Icon name="x" className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {neu.map((n, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl">
              <img src={n.vorschau} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setNeu((x) => x.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white" aria-label="Foto entfernen"><Icon name="x" className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {fotos.length + neu.length < 3 && (
            <button type="button" onClick={() => input.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-himmel-300 text-himmel-600" aria-label="Foto hinzufügen">
              <Icon name="plus" />
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => bilder(e.target.files)} />
      </div>
      {fehler && <Fehler fehler={fehler} />}
      <div className="flex gap-2">
        <Knopf type="button" art="sekundaer" className="flex-1" onClick={fertig}>Abbrechen</Knopf>
        <Knopf type="submit" className="flex-1" laedt={laedt}>Speichern</Knopf>
      </div>
      <p className="text-xs text-slate-500">Beiträge laufen nach 60 Tagen automatisch ab.</p>
    </form>
  );
}

function BrettInhalt() {
  const s = useSitzung()!;
  const { daten, fehler, laedt, neu } = useLaden(() => api<BrettBeitrag[]>('brett_liste'), [s.token]);
  const [filter, setFilter] = useState<Kat | ''>('');
  const [form, setForm] = useState<BrettBeitrag | 'neu' | null>(null);

  async function loeschen(b: BrettBeitrag) {
    if (!confirm(`„${b.titel}“ wirklich löschen?`)) return;
    await api('brett_loeschen', { id: b.id });
    void neu();
  }

  if (form) return <Formular alt={form === 'neu' ? undefined : form} fertig={() => { setForm(null); void neu(); }} />;
  const liste = (daten ?? []).filter((b) => !filter || b.kategorie === filter);

  return (
    <div className="space-y-3">
      <Knopf className="w-full" onClick={() => setForm('neu')}><Icon name="plus" /> Neuer Beitrag</Knopf>
      <div className="flex gap-2 overflow-x-auto">
        {([['', 'Alle'], ['biete', 'Biete'], ['suche', 'Suche'], ['info', 'Info']] as const).map(([k, n]) => (
          <button key={k} onClick={() => setFilter(k)} className={klassen('min-h-10 rounded-full px-4 text-sm font-semibold', filter === k ? 'bg-himmel-600 text-white' : 'bg-white ring-1 ring-himmel-200 dark:bg-slate-800 dark:ring-slate-700')}>{n}</button>
        ))}
      </div>
      {laedt && !daten && <Laden />}
      {fehler && <Fehler fehler={fehler} nochmal={neu} />}
      {daten && !liste.length && <Leer>Noch keine Beiträge.</Leer>}
      {liste.map((b) => {
        const eigen = b.verfasserId === s.mitgliedId || s.rolle === 'admin';
        const k = b.kontakt ? kontaktLink(b.kontakt) : null;
        return (
          <article key={b.id} className="karte overflow-hidden">
            {b.fotos.length > 0 && (
              <div className="flex snap-x gap-1 overflow-x-auto">
                {b.fotos.map((f) => <img key={f} src={f} alt="" className="h-48 w-full shrink-0 snap-center object-cover" loading="lazy" />)}
              </div>
            )}
            <div className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className={klassen('rounded-full px-2.5 py-0.5 text-xs font-bold', KAT[b.kategorie].farbe)}>{KAT[b.kategorie].name}</span>
                {b.preis && <span className="font-bold text-mgi-rot">{b.preis}</span>}
              </div>
              <h2 className="text-lg font-bold">{b.titel}</h2>
              {b.text && <p className="mt-1 whitespace-pre-line text-slate-700 dark:text-slate-300">{b.text}</p>}
              <p className="mt-2 text-xs text-slate-500">{b.verfasser} · {datumKurz(b.erstellt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {k && (
                  <a href={k.href} target={k.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-himmel-600 px-4 font-semibold text-white">
                    <Icon name={k.icon} className="h-5 w-5" /> {k.text}
                  </a>
                )}
                {eigen && (
                  <>
                    <Knopf art="leise" onClick={() => setForm(b)}><Icon name="stift" className="h-5 w-5" /> Bearbeiten</Knopf>
                    <Knopf art="leise" className="!text-mgi-rot" onClick={() => loeschen(b)}><Icon name="muell" className="h-5 w-5" /> Löschen</Knopf>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
      {daten && <Hinweis>Kontaktdaten sind nur für angemeldete Mitglieder sichtbar.</Hinweis>}
    </div>
  );
}

export default function Brett() {
  return (
    <Seite titel="Schwarzes Brett">
      <NurMitglied text="Das Schwarze Brett ist nur für Mitglieder.">
        <BrettInhalt />
      </NurMitglied>
    </Seite>
  );
}
