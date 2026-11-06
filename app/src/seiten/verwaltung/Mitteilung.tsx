import { useState } from 'react';
import { NurMitglied } from '../../components/Anmelden';
import { Feld, Fehler, Hinweis, Knopf, Seite } from '../../components/ui';
import { pushKonfiguriert } from '../../config';
import { api } from '../../lib/api';

function Inhalt() {
  const [titel, setTitel] = useState('');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Mitteilung „${titel}“ jetzt an alle senden?`)) return;
    setLaedt(true); setMsg(null);
    try {
      const r = await api<{ gesendet: number }>('mitteilung_senden', { titel, text });
      setMsg({ ok: true, text: `An ${r.gesendet} Gerät(e) gesendet.` });
      setTitel(''); setText('');
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setLaedt(false); }
  }

  return (
    <form onSubmit={senden} className="space-y-4">
      {!pushKonfiguriert && <Hinweis art="warnung">Push ist noch nicht eingerichtet (Firebase in config.ts und FCM_SERVICE_ACCOUNT im Apps Script). Bis dahin wird nichts zugestellt.</Hinweis>}
      <div className="karte space-y-3 p-4">
        <Feld label="Titel"><input className="eingabe" required maxLength={60} value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Platz heute gesperrt" /></Feld>
        <Feld label="Text"><textarea className="eingabe min-h-24" maxLength={240} value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Wegen Mäharbeiten bis 14 Uhr kein Flugbetrieb." /></Feld>
      </div>
      <Hinweis>Geht an alle Mitglieder, die „Wichtige Mitteilungen“ eingeschaltet haben.</Hinweis>
      {msg && (msg.ok ? <Hinweis art="ok">{msg.text}</Hinweis> : <Fehler fehler={msg.text} />)}
      <Knopf type="submit" className="w-full" laedt={laedt}>Senden</Knopf>
    </form>
  );
}

export default function Mitteilung() {
  return <Seite titel="Mitteilung senden"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
