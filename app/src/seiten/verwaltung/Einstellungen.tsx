import { useEffect, useState } from 'react';
import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Seite } from '../../components/ui';
import { api } from '../../lib/api';
import { useEinstellungen } from '../../lib/einstellungen';
import { markdown } from '../../lib/helfer';
import type { Einstellungen as E } from '../../lib/model';

function Inhalt() {
  const { einstellungen, geladen, setEinstellungen } = useEinstellungen();
  const [e, setE] = useState<E>(einstellungen);
  const [vorschau, setVorschau] = useState<'platzordnung' | 'notfallInfo' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);
  useEffect(() => { if (geladen) setE(einstellungen); }, [geladen, einstellungen]);

  async function speichern() {
    setLaedt(true); setMsg(null);
    try {
      const neu = await api<E>('einstellungen_speichern', { ...e });
      setEinstellungen(neu);
      setMsg({ ok: true, text: 'Gespeichert.' });
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setLaedt(false); }
  }

  const mdFeld = (k: 'platzordnung' | 'notfallInfo', label: string) => (
    <div className="karte space-y-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-bold">{label}</span>
        <button className="text-sm font-semibold text-himmel-700 dark:text-himmel-300" onClick={() => setVorschau(vorschau === k ? null : k)}>{vorschau === k ? 'Bearbeiten' : 'Vorschau'}</button>
      </div>
      {vorschau === k
        ? <div className="md rounded-xl bg-himmel-50 p-3 dark:bg-slate-800" dangerouslySetInnerHTML={{ __html: markdown(e[k]) }} />
        : <textarea className="eingabe min-h-48 font-mono text-sm" value={e[k]} onChange={(x) => setE({ ...e, [k]: x.target.value })} />}
      <p className="text-xs text-slate-500">Formatierung: ## Überschrift · - Aufzählung · **fett** · _kursiv_ · [Text](https://link)</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {mdFeld('platzordnung', 'Platzordnung')}
      <div className="karte space-y-2 p-4">
        <Feld label="Zufahrt für den Rettungsdienst" hilfe="Steht auf der Notfall-Seite unter der Adresse – so formulieren, dass man es am Telefon vorlesen kann. Leer lassen = wird nicht angezeigt.">
          <textarea className="eingabe min-h-24" value={e.zufahrt ?? ''} onChange={(x) => setE({ ...e, zufahrt: x.target.value })}
            placeholder="z. B. Über die Moosstraße von Ismaning bis zur Kreuzung mit der Wiesstraße, dann Feldweg nach Osten …" />
        </Feld>
      </div>
      {mdFeld('notfallInfo', 'Notfall-Infos (Erste-Hilfe-Kasten, Feuerlöscher …)')}

      <div className="karte space-y-2 p-4">
        <span className="font-bold">Notfall-Kontakte</span>
        {e.notfallKontakte.map((k, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className="eingabe" placeholder="Name" value={k.name} onChange={(x) => setE({ ...e, notfallKontakte: e.notfallKontakte.map((y, j) => (j === i ? { ...y, name: x.target.value } : y)) })} />
            <input className="eingabe" placeholder="Telefon" inputMode="tel" value={k.telefon} onChange={(x) => setE({ ...e, notfallKontakte: e.notfallKontakte.map((y, j) => (j === i ? { ...y, telefon: x.target.value } : y)) })} />
            <button className="px-2 text-mgi-rot" aria-label="Kontakt entfernen" onClick={() => setE({ ...e, notfallKontakte: e.notfallKontakte.filter((_, j) => j !== i) })}><Icon name="x" /></button>
            <input className="eingabe col-span-2" placeholder="Rolle (z. B. Vorsitzender)" value={k.rolle} onChange={(x) => setE({ ...e, notfallKontakte: e.notfallKontakte.map((y, j) => (j === i ? { ...y, rolle: x.target.value } : y)) })} />
          </div>
        ))}
        <Knopf art="leise" onClick={() => setE({ ...e, notfallKontakte: [...e.notfallKontakte, { name: '', rolle: '', telefon: '' }] })}><Icon name="plus" className="h-5 w-5" /> Kontakt hinzufügen</Knopf>
      </div>

      <div className="karte grid grid-cols-2 gap-3 p-4">
        <Feld label="Wind-Ampel gelb ab (Böen km/h)"><input className="eingabe" type="number" value={e.windGelb} onChange={(x) => setE({ ...e, windGelb: Number(x.target.value) })} /></Feld>
        <Feld label="Wind-Ampel rot ab (Böen km/h)"><input className="eingabe" type="number" value={e.windRot} onChange={(x) => setE({ ...e, windRot: Number(x.target.value) })} /></Feld>
        <Feld label="Flugbuch: automatisch abmelden nach (Std.)"><input className="eingabe" type="number" min={1} max={24} value={e.checkinStunden} onChange={(x) => setE({ ...e, checkinStunden: Number(x.target.value) })} /></Feld>
      </div>

      <div className="karte p-4">
        <Feld label="Datenschutz-Hinweis beim Foto-Upload"><textarea className="eingabe min-h-24" value={e.datenschutzFoto} onChange={(x) => setE({ ...e, datenschutzFoto: x.target.value })} /></Feld>
      </div>

      {msg && (msg.ok ? <Hinweis art="ok">{msg.text}</Hinweis> : <Fehler fehler={msg.text} />)}
      <Knopf className="w-full" onClick={speichern} laedt={laedt}>Speichern</Knopf>
    </div>
  );
}

export default function Einstellungen() {
  return <Seite titel="Einstellungen"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
