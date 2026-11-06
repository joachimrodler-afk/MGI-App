/**
 * Wetter für den Flugplatz.
 * Aktuelle Werte und Vorhersage kommen von Open-Meteo (kostenlos, ohne API-Key, DSGVO-freundlich).
 * Die Vereins-Wetterstation bei Wettermonster bietet keine offene Schnittstelle –
 * sie wird in der App verlinkt (siehe config.wetter.stationUrl).
 */
import { config } from '../config';

export interface WetterJetzt {
  zeit: string;
  temperatur: number;
  wind: number; // km/h
  boeen: number; // km/h
  richtung: number; // Grad
  niederschlag: number; // mm
  code: number;
  sonnenuntergang?: string;
  stunden: { zeit: string; wind: number; boeen: number; regenWkt: number; temperatur: number }[];
}

export async function ladeWetter(): Promise<WetterJetzt> {
  const p = new URLSearchParams({
    latitude: String(config.platz.lat),
    longitude: String(config.platz.lon),
    current: 'temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,weather_code',
    hourly: 'temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability',
    daily: 'sunset',
    timezone: 'Europe/Berlin',
    forecast_days: '2',
    wind_speed_unit: 'kmh',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
  if (!res.ok) throw new Error('Wetterdienst nicht erreichbar');
  const j = await res.json();
  const jetzt = j.current.time as string;
  const idx = (j.hourly.time as string[]).findIndex((t) => t >= jetzt.slice(0, 13));
  const stunden = (j.hourly.time as string[]).slice(Math.max(0, idx), Math.max(0, idx) + 12).map((t, i) => {
    const k = Math.max(0, idx) + i;
    return {
      zeit: t,
      wind: j.hourly.wind_speed_10m[k],
      boeen: j.hourly.wind_gusts_10m[k],
      regenWkt: j.hourly.precipitation_probability[k] ?? 0,
      temperatur: j.hourly.temperature_2m[k],
    };
  });
  return {
    zeit: jetzt,
    temperatur: j.current.temperature_2m,
    wind: j.current.wind_speed_10m,
    boeen: j.current.wind_gusts_10m,
    richtung: j.current.wind_direction_10m,
    niederschlag: j.current.precipitation,
    code: j.current.weather_code,
    sonnenuntergang: j.daily?.sunset?.[0],
    stunden,
  };
}

const RICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
export function himmelsrichtung(grad: number) {
  return RICHTUNGEN[Math.round(grad / 45) % 8];
}

export function wetterText(code: number) {
  if (code === 0) return 'Klar';
  if (code <= 2) return 'Leicht bewölkt';
  if (code === 3) return 'Bedeckt';
  if (code <= 48) return 'Nebel';
  if (code <= 57) return 'Nieselregen';
  if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Regenschauer';
  if (code <= 86) return 'Schneeschauer';
  return 'Gewitter';
}

export type Ampel = 'gruen' | 'gelb' | 'rot';
export function windAmpel(boeen: number, gelb: number, rot: number, niederschlag = 0, code = 0): Ampel {
  if (boeen >= rot || code >= 95) return 'rot';
  if (boeen >= gelb || niederschlag > 0.2) return 'gelb';
  return 'gruen';
}
