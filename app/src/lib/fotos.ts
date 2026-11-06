/**
 * Foto-Warteschlange: Fotos werden zuerst lokal (IndexedDB) gespeichert und dann hochgeladen.
 * Ohne Netz bleiben sie in der Warteschlange und werden beim nächsten Online-Gehen
 * bzw. beim nächsten Öffnen der App automatisch hochgeladen.
 */
import { createStore, del, entries, set } from 'idb-keyval';
import { api } from './api';

export interface WarteFoto {
  id: string;
  base64: string;
  kategorie: string;
  titel: string;
  aufgenommen: string;
  versuche: number;
  fehler?: string;
}

const store = createStore('mgi-fotos', 'warteschlange');
let laeuft = false;

export async function fotoEinreihen(f: Omit<WarteFoto, 'id' | 'versuche'>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await set(id, { ...f, id, versuche: 0 }, store);
  benachrichtigen();
  return id;
}

export async function warteschlange(): Promise<WarteFoto[]> {
  return (await entries<string, WarteFoto>(store)).map(([, v]) => v).sort((a, b) => a.id.localeCompare(b.id));
}

export async function fotoEntfernen(id: string) {
  await del(id, store);
  benachrichtigen();
}

function benachrichtigen() {
  window.dispatchEvent(new Event('mgi-fotos'));
}

/** Lädt alle wartenden Fotos nacheinander hoch. Gibt Anzahl erfolgreicher Uploads zurück. */
export async function hochladen(fortschritt?: (fertig: number, gesamt: number) => void): Promise<number> {
  if (laeuft) return 0;
  laeuft = true;
  let ok = 0;
  try {
    const liste = await warteschlange();
    for (let i = 0; i < liste.length; i++) {
      if (!navigator.onLine) break;
      const f = liste[i];
      fortschritt?.(i, liste.length);
      try {
        await api('foto_hochladen', { base64: f.base64, mimeType: 'image/jpeg', kategorie: f.kategorie, titel: f.titel, aufgenommen: f.aufgenommen });
        await del(f.id, store);
        ok++;
      } catch (e) {
        await set(f.id, { ...f, versuche: f.versuche + 1, fehler: (e as Error).message }, store);
        if ((e as { status?: number }).status === 401) break; // nicht angemeldet
      }
    }
    fortschritt?.(liste.length, liste.length);
  } finally {
    laeuft = false;
    benachrichtigen();
  }
  return ok;
}

// Automatisch hochladen, sobald wieder Netz da ist
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void hochladen());
}
