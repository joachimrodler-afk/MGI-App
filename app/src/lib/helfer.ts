/** Kleine Helfer: Datum, Bilder, Markdown */

const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Lokale Zeit „yyyy-MM-ddTHH:mm:ss“ (ohne Zeitzone) in Bestandteile zerlegen */
export function lokal(s: string) {
  const [d, t = '00:00:00'] = s.split('T');
  const [j, m, tag] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return { j, m, tag, h, min, datum: new Date(j, m - 1, tag, h, min) };
}

export function terminDatum(beginn: string, ganztaegig: boolean, ende?: string) {
  const b = lokal(beginn);
  let s = `${WT[b.datum.getDay()]}, ${b.tag}. ${MON[b.m - 1]}`;
  if (!ganztaegig) {
    s += `, ${String(b.h).padStart(2, '0')}:${String(b.min).padStart(2, '0')}`;
    if (ende) {
      const e = lokal(ende);
      if (e.tag === b.tag && e.m === b.m) s += `–${String(e.h).padStart(2, '0')}:${String(e.min).padStart(2, '0')}`;
    }
    s += ' Uhr';
  }
  return s;
}

export function tageBis(beginn: string) {
  const b = lokal(beginn).datum;
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const t = new Date(b);
  t.setHours(0, 0, 0, 0);
  const n = Math.round((t.getTime() - heute.getTime()) / 86400000);
  return n === 0 ? 'heute' : n === 1 ? 'morgen' : n < 0 ? 'läuft' : `in ${n} Tagen`;
}

export function datumKurz(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function uhrzeit(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function vorZeit(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

/** ICS-Datei für einen Termin (zum eigenen Kalender hinzufügen) */
export function terminIcs(t: { titel: string; beginn: string; ende: string; ganztaegig: boolean; ort?: string; beschreibung?: string }) {
  const f = (s: string, nurDatum: boolean) => (nurDatum ? s.slice(0, 10).replace(/-/g, '') : s.replace(/[-:]/g, '').slice(0, 15));
  const esc = (s = '') => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const dt = t.ganztaegig
    ? [`DTSTART;VALUE=DATE:${f(t.beginn, true)}`, `DTEND;VALUE=DATE:${f(t.ende, true)}`]
    : [`DTSTART;TZID=Europe/Berlin:${f(t.beginn, false)}`, `DTEND;TZID=Europe/Berlin:${f(t.ende, false)}`];
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MGI//Vereins-App//DE', 'BEGIN:VEVENT',
    `UID:${Date.now()}@mgi-app`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    ...dt, `SUMMARY:${esc(t.titel)}`, t.ort ? `LOCATION:${esc(t.ort)}` : '', t.beschreibung ? `DESCRIPTION:${esc(t.beschreibung)}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

export function herunterladen(name: string, inhalt: string, typ: string) {
  const blob = new Blob([inhalt], { type: typ });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Bild verkleinern (lange Kante max. 2000 px, JPEG 85 %) und als Base64 (ohne Präfix) liefern */
export async function bildVerkleinern(datei: Blob, maxKante = 2000, qualitaet = 0.85): Promise<{ base64: string; vorschau: string }> {
  const bmp = await createImageBitmap(datei, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const f = Math.min(1, maxKante / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * f);
  canvas.height = Math.round(bmp.height * f);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', qualitaet);
  return { base64: url.slice(url.indexOf(',') + 1), vorschau: url };
}

/**
 * Sehr kleiner, sicherer Markdown-Renderer (Überschriften, Listen, fett, kursiv, Links).
 * Erst wird ALLES HTML-escaped, dann werden nur die erlaubten Auszeichnungen eingesetzt.
 */
export function markdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])_(.+?)_/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|tel:[+\d ]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out: string[] = [];
  let liste = false;
  for (const zeile of md.split('\n')) {
    const z = zeile.trimEnd();
    const li = /^\s*[-*]\s+(.*)$/.exec(z);
    if (li) {
      if (!liste) { out.push('<ul>'); liste = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    if (liste) { out.push('</ul>'); liste = false; }
    const h = /^(#{1,3})\s+(.*)$/.exec(z);
    if (h) out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`);
    else if (z) out.push(`<p>${inline(z)}</p>`);
  }
  if (liste) out.push('</ul>');
  return out.join('');
}

export function klassen(...k: (string | false | null | undefined)[]) {
  return k.filter(Boolean).join(' ');
}
