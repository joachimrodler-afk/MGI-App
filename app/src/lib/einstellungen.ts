import { useEffect, useState } from 'react';
import { api, erinnere, merke } from './api';
import type { Einstellungen } from './model';

const LEER: Einstellungen = {
  platzordnung: '',
  notfallInfo: '',
  notfallKontakte: [],
  zufahrt: '',
  windGelb: 25,
  windRot: 40,
  datenschutzFoto: '',
  checkinStunden: 4,
};

/** Vereinseinstellungen – werden lokal gespeichert, damit Notfall & Platzordnung offline funktionieren */
export function useEinstellungen() {
  const [e, setE] = useState<Einstellungen>(() => erinnere<Einstellungen>('einstellungen') ?? LEER);
  const [geladen, setGeladen] = useState(false);
  useEffect(() => {
    api<Einstellungen>('einstellungen')
      .then((x) => {
        setE(x);
        merke('einstellungen', x);
      })
      .catch(() => undefined)
      .finally(() => setGeladen(true));
  }, []);
  return { einstellungen: e, geladen, setEinstellungen: (x: Einstellungen) => { setE(x); merke('einstellungen', x); } };
}
