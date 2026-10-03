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
    origin?: { name?: string };
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

    const entries = await Promise.all(
      data.requests.map(async (req) => {
        try {
          const loc = await findLocationId(req.destQuery);
          if (!loc) return [req.destQuery, null] as const;

          const params = new URLSearchParams({
            origin: String(EMBER_ORIGIN_ID),
            destination: String(loc.id),
            departure_date_from: from.toISOString(),
            departure_date_to: to.toISOString(),
            adult: "1",
          });
          const res = await fetch(`${EMBER_API}/v1/quotes/?${params}`);
          if (!res.ok) return [req.destQuery, null] as const;
          const body = (await res.json()) as { quotes?: EmberQuote[] };

          // First departure that still gets us there before the activity starts,
          // leaving enough time for the first/last mile on foot.
          for (const quote of body.quotes ?? []) {
            const leg = quote.legs?.[0];
            const depIso = leg?.departure?.scheduled;
            const arrIso = leg?.arrival?.scheduled;
            if (!leg || !depIso || !arrIso) continue;
            const depMin = isoToLondonMin(depIso);
            const arrMin = isoToLondonMin(arrIso);
            const leaveByMin = depMin - req.firstMileMin;
            const arriveMin = arrMin + req.lastMileMin;
            if (leaveByMin < data.nowMin || arriveMin > req.startMin) continue;

            const journey: Journey = {
              leaveByMin,
              totalMin: arriveMin - leaveByMin,
              live: true,
              pricePence: quote.prices?.adult,
              seatsLeft: quote.availability?.seat,
              legs: [
                {
                  mode: "walk",
                  label: "Walk to Dundee (City Centre) stop",
                  durationMin: req.firstMileMin,
                },
                {
                  mode: "bus",
                  label: `Ember → ${leg.destination?.name ?? loc.name}`,
                  durationMin: arrMin - depMin,
                },
                { mode: "walk", label: "Walk to the venue", durationMin: req.lastMileMin },
              ],
            };
            return [req.destQuery, journey] as const;
          }
          return [req.destQuery, null] as const;
        } catch {
          return [req.destQuery, null] as const;
        }
      }),
    );

    return { journeys: Object.fromEntries(entries) as Record<string, Journey | null> };
  });
