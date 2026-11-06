import { api } from './api';
import type { Wertungsart } from './model';
import { VORLAGEN } from './vorlagen';

/** Gespeicherte Wertungsarten + Vorlagen, die (noch) nicht angepasst wurden */
export async function alleArten(): Promise<(Wertungsart & { vorlage?: boolean })[]> {
  const gespeichert = await api<Wertungsart[]>('wertungsarten');
  const ids = new Set(gespeichert.map((a) => a.id));
  return [...gespeichert, ...VORLAGEN.filter((v) => !ids.has(v.id)).map((v) => ({ ...v, vorlage: true }))]
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
