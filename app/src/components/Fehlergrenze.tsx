import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Einmal neu laden, wenn nach einem Update alte Programmteile fehlen (sonst weißer Bildschirm). */
export function einmalNeuLaden(): boolean {
  try {
    const zuletzt = Number(sessionStorage.getItem('mgi.neugeladen') || 0);
    if (Date.now() - zuletzt < 30000) return false; // nicht in einer Schleife neu laden
    sessionStorage.setItem('mgi.neugeladen', String(Date.now()));
  } catch {
    /* ignorieren */
  }
  window.location.reload();
  return true;
}

/** Fängt Fehler beim Anzeigen ab und zeigt statt eines weißen Bildschirms einen Neu-laden-Knopf. */
/** Zwischengespeicherte Daten und Programmdateien löschen, dann neu laden (Anmeldung bleibt erhalten). */
async function aufraeumenUndNeuLaden() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('mgi.cache.')).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignorieren */
  }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const namen = (await caches?.keys?.()) ?? [];
    await Promise.all(namen.map((n) => caches.delete(n)));
  } catch {
    /* ignorieren */
  }
  window.location.reload();
}

export class Fehlergrenze extends Component<{ children: ReactNode }, { fehler: boolean; text: string }> {
  state = { fehler: false, text: '' };
  static getDerivedStateFromError(err: unknown) {
    const e = err as Error;
    return { fehler: true, text: `${e?.name ?? 'Fehler'}: ${e?.message ?? String(err)}`.slice(0, 300) };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(err, info.componentStack);
    // Typischer Fall nach einem Update: Programmteil (Chunk) nicht mehr vorhanden → automatisch neu laden
    if (/dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|Loading chunk/i.test(String(err?.message))) {
      einmalNeuLaden();
    }
  }
  render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <p className="text-lg font-semibold">Hoppla, da ist etwas schiefgelaufen.</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">Wahrscheinlich gab es gerade ein Update der App. Bitte neu laden.</p>
        <button type="button" onClick={() => void aufraeumenUndNeuLaden()} className="min-h-12 w-full rounded-xl bg-mgi-rot px-4 py-2.5 font-semibold text-white">
          Neu laden
        </button>
        <p className="break-words text-xs text-slate-400">Technischer Hinweis für den Admin: {this.state.text} · Version {__APP_VERSION__}</p>
      </div>
    );
  }
}
