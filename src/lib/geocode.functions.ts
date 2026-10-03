import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type GeoHit = { lat: number; lng: number } | null;

// Server-side cache, shared across requests. Misses are cached too so failed
// lookups are not retried on every search.
const cache = new Map<string, GeoHit>();

async function nominatim(q: string): Promise<GeoHit> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "gb");
  // Bias to central/east Scotland.
  url.searchParams.set("viewbox", "-4.6,57.3,-1.8,55.6");
  url.searchParams.set("bounded", "1");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Event Spark hackathon demo (venue lookup)" }, signal: ctrl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { lat: string; lon: string }[];
    return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export const geocodeVenues = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ places: z.array(z.object({ venue: z.string().max(200), town: z.string().max(80) })).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const out: Record<string, GeoHit> = {};
    for (const p of data.places) {
      const key = `${p.venue}|${p.town}`.toLowerCase();
      if (cache.has(key)) { out[key] = cache.get(key)!; continue; }
      // Venue + town first, then the venue's main name without sub-rooms ("…, Studio 3").
      let hit = await nominatim(`${p.venue}, ${p.town}`);
      const main = p.venue.split(",")[0]!.trim();
      if (!hit && main !== p.venue) hit = await nominatim(`${main}, ${p.town}`);
      cache.set(key, hit);
      out[key] = hit;
      await new Promise((r) => setTimeout(r, 1000)); // respect Nominatim's 1 req/s policy
    }
    return out;
  });
