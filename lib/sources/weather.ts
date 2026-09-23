import { z } from "zod";
import { cached, DAY, HOUR } from "./cache";
import { fetchJson } from "./http";

export interface KickoffWeather {
  time: string;
  tempC: number;
  precipMm: number;
  precipProbability: number | null;
  windKmh: number;
  code: number;
  summary: string;
}

const ForecastSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    precipitation: z.array(z.number().nullable()),
    precipitation_probability: z.array(z.number().nullable()).optional(),
    wind_speed_10m: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()),
  }),
});

const GeocodeSchema = z.object({
  results: z.array(z.object({ latitude: z.number(), longitude: z.number(), country: z.string().optional() })).optional(),
});

/** Open-Meteo forecast for the kick-off hour. Returns null when kick-off is beyond the 16-day forecast window. */
export async function getKickoffWeather(lat: number, lon: number, kickoffIso: string): Promise<KickoffWeather | null> {
  const ms = new Date(kickoffIso).getTime() - Date.now();
  if (ms > 15 * DAY || ms < -DAY) return null;
  const hour = new Date(kickoffIso);
  hour.setUTCMinutes(0, 0, 0);
  const key = hour.toISOString().slice(0, 13);

  return cached(`weather:${lat.toFixed(2)},${lon.toFixed(2)}:${key}`, HOUR, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,weather_code` +
      `&timezone=UTC&forecast_days=16`;
    const d = await fetchJson(url, ForecastSchema);
    const i = d.hourly.time.findIndex((t) => t.startsWith(key));
    if (i < 0) return null;
    const code = d.hourly.weather_code[i] ?? 0;
    return {
      time: `${d.hourly.time[i]}Z`,
      tempC: Math.round(d.hourly.temperature_2m[i] ?? 0),
      precipMm: d.hourly.precipitation[i] ?? 0,
      precipProbability: d.hourly.precipitation_probability?.[i] ?? null,
      windKmh: Math.round(d.hourly.wind_speed_10m[i] ?? 0),
      code,
      summary: describe(code),
    };
  });
}

/** Fallback location when Wikidata has no stadium coordinates: geocode the venue's city. */
export function geocodeCity(city: string, country?: string | null): Promise<{ lat: number; lon: number } | null> {
  return cached(`geocode:${city}:${country ?? ""}`, 30 * DAY, async () => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en`;
    const d = await fetchJson(url, GeocodeSchema);
    const r = d.results?.find((x) => !country || x.country === country) ?? d.results?.[0];
    return r ? { lat: r.latitude, lon: r.longitude } : null;
  });
}

// WMO weather codes → short text.
function describe(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}
