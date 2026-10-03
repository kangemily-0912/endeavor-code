import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EMBER_ORIGIN_ID, type Journey } from "./activities";

const EMBER_API = "https://api.ember.to";

type EmberLocation = { id: number; name: string; region_name?: string };

type EmberQuote = {
  availability?: { seat?: number };
  prices?: { adult?: number };
  legs?: Array<{
    departure?: { scheduled?: string; estimated?: string };
    arrival?: { scheduled?: string; estimated?: string };
    origin?: { name?: string; atco_code?: string };
    destination?: { name?: string };
    description?: { brand?: string; route_number?: string };
  }>;
};

// Convert an ISO timestamp to minutes-after-midnight in Europe/London,
// so live Ember times line up with the app's local demo clock.
function isoToLondonMin(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

// Live departures from Ember's GTFS-RT trip updates: stopId (ATCO) -> times (unix s).
let rtCache: { at: number; map: Map<string, number[]> } | null = null;
async function loadRealtime(): Promise<Map<string, number[]>> {
  if (rtCache && Date.now() - rtCache.at < 30_000) return rtCache.map;
  const map = new Map<string, number[]>();
  try {
    const { default: G } = await import("gtfs-realtime-bindings");
    const res = await fetch(`${EMBER_API}/v1/gtfs/realtime/trip-updates/`);
    if (res.ok) {
      const feed = G.transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer()));
      for (const e of feed.entity) {
        for (const u of e.tripUpdate?.stopTimeUpdate ?? []) {
          const t = Number(u.departure?.time ?? 0);
          if (!u.stopId || !t) continue;
          const list = map.get(u.stopId) ?? [];
          list.push(t);
          map.set(u.stopId, list);
        }
      }
    }
  } catch {
    // feed down: fall back to scheduled times
  }
  rtCache = { at: Date.now(), map };
  return map;
}

// Closest live departure at this stop within 20 min of the scheduled time.
function matchLive(rt: Map<string, number[]>, atco: string | undefined, schedSec: number): number | null {
  if (!atco) return null;
  let best: number | null = null;
  for (const t of rt.get(atco) ?? []) {
    if (Math.abs(t - schedSec) <= 1200 && (best == null || Math.abs(t - schedSec) < Math.abs(best - schedSec))) best = t;
  }
  return best;
}

async function findLocationId(query: string): Promise<EmberLocation | null> {
  const res = await fetch(
    `${EMBER_API}/v1/locations/search/?query=${encodeURIComponent(query)}&limit=1`,
  );
  if (!res.ok) return null;
  const locations = (await res.json()) as EmberLocation[];
  return locations[0] ?? null;
}

export const getEmberJourneys = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        // destQuery -> { firstMileMin, lastMileMin, startMin }
        requests: z.array(
          z.object({
            destQuery: z.string(),
            firstMileMin: z.number(),
            lastMileMin: z.number(),
            startMin: z.number(),
          }),
        ),
        nowMin: z.number(), // minutes after midnight, Europe/London
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const from = new Date();
    const to = new Date(from.getTime() + 10 * 60 * 60 * 1000);

    const rt = await loadRealtime();
    const entries = await Promise.all(
      data.requests.map(async (req) => {
        try {
          const loc = await findLocationId(req.destQuery);
          if (!loc) return [req.destQuery, [] as Journey[]] as const;

          const params = new URLSearchParams({
            origin: String(EMBER_ORIGIN_ID),
            destination: String(loc.id),
            departure_date_from: from.toISOString(),
            departure_date_to: to.toISOString(),
            adult: "1",
          });
          const res = await fetch(`${EMBER_API}/v1/quotes/?${params}`);
          if (!res.ok) return [req.destQuery, [] as Journey[]] as const;
          const body = (await res.json()) as { quotes?: EmberQuote[] };

          // Every departure that still gets us there in time, with live ETAs.
          const options: Journey[] = [];
          for (const quote of body.quotes ?? []) {
            const leg = quote.legs?.[0];
            const depIso = leg?.departure?.scheduled;
            const arrIso = leg?.arrival?.scheduled;
            if (!leg || !depIso || !arrIso) continue;
            const schedDepSec = Date.parse(depIso) / 1000;
            const liveDepSec =
              matchLive(rt, leg.origin?.atco_code, schedDepSec) ??
              (leg.departure?.estimated ? Date.parse(leg.departure.estimated) / 1000 : null);
            const realtime = liveDepSec != null;
            const delaySec = liveDepSec != null ? liveDepSec - schedDepSec : 0;
            const depMin = isoToLondonMin(new Date((schedDepSec + delaySec) * 1000).toISOString());
            const arrMin = isoToLondonMin(
              new Date(Date.parse(leg.arrival?.estimated ?? arrIso) + (leg.arrival?.estimated ? 0 : delaySec * 1000)).toISOString(),
            );
            const leaveByMin = depMin - req.firstMileMin;
            const arriveMin = arrMin + req.lastMileMin;
            if (leaveByMin < data.nowMin || arriveMin > req.startMin) continue;
            options.push({
              operator: "Ember",
              leaveByMin,
              departMin: depMin,
              arriveMin,
              realtime,
              delayMin: Math.round(delaySec / 60),
              totalMin: arriveMin - leaveByMin,
              live: true,
              pricePence: quote.prices?.adult,
              seatsLeft: quote.availability?.seat,
              legs: [
                { mode: "walk", label: `Walk to ${leg.origin?.name ?? "Dundee"} stop`, durationMin: req.firstMileMin },
                { mode: "bus", label: `Ember → ${leg.destination?.name ?? loc.name}`, durationMin: arrMin - depMin },
                { mode: "walk", label: "Walk to the venue", durationMin: req.lastMileMin },
              ],
            });
            if (options.length >= 4) break;
          }
          return [req.destQuery, options] as const;
        } catch {
          return [req.destQuery, [] as Journey[]] as const;
        }
      }),
    );

    return { journeys: Object.fromEntries(entries) as Record<string, Journey[]>, realtimeTrips: rt.size };
  });
