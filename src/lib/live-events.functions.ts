import { createServerFn } from "@tanstack/react-start";

// Public pages we watch: society bio links, union event lists and Dundee venues.
export const SOURCES: { name: string; url: string; town: string }[] = [
  { name: "WiCS · Linktree", url: "https://linktr.ee/standrewswomenincs", town: "St Andrews" },
  { name: "WiCS · Website", url: "https://standrewswomenincs.com", town: "St Andrews" },
  { name: "Students' Union · Linktree", url: "https://linktr.ee/standrewsunion", town: "St Andrews" },
  { name: "Students' Union · Events", url: "https://www.yourunion.net/events", town: "St Andrews" },
  { name: "Union · Society events", url: "https://www.yourunion.net/events/societies/", town: "St Andrews" },
  { name: "Debating Society · Linktree", url: "https://linktr.ee/uniondebatingsociety", town: "St Andrews" },
  { name: "Investment Society", url: "https://www.sta-investsoc.com", town: "St Andrews" },
  { name: "University of St Andrews", url: "https://www.st-andrews.ac.uk/news/events/", town: "St Andrews" },
  { name: "Archaeology Society", url: "https://archsoc.wp.st-andrews.ac.uk", town: "St Andrews" },
  { name: "DUSA · What's on", url: "https://www.mydusa.co.uk/whatson", town: "Dundee" },
  { name: "DCA · What's on", url: "https://www.dca.org.uk/whats-on", town: "Dundee" },
  { name: "Dundee Rep · What's on", url: "https://www.dundeerep.co.uk/whats-on", town: "Dundee" },
  { name: "Leisure & Culture Dundee", url: "https://www.leisureandculturedundee.com/whats-on", town: "Dundee" },
];

export type LiveEvent = {
  id: string;
  title: string;
  description: string;
  startIso: string; // local Europe/London time, e.g. 2026-10-03T19:00
  durationMin: number;
  venue: string;
  town: string;
  priceGbp: number;
  tags: string[];
  url: string;
  source: string;
};

export type SourceStatus = { name: string; url: string; ok: boolean; count: number };

const TTL_MS = 60 * 60 * 1000; // refresh hourly
type Snapshot = { at: number; events: LiveEvent[]; sources: SourceStatus[] };
let cache: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

function htmlToText(html: string, base: string): string {
  // Linktree ships its links as JSON — keep that, it's the richest bit.
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  let extra = "";
  if (next) {
    try {
      const links = JSON.parse(next[1]!)?.props?.pageProps?.links ?? [];
      extra = links.map((l: { title?: string; url?: string }) => `- ${l.title} (${l.url})`).join("\n");
    } catch {
      /* ignore */
    }
  }
  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, t: string) => {
      let abs = href;
      try {
        abs = new URL(href, base).toString();
      } catch {
        /* keep */
      }
      return ` ${t} [${abs}] `;
    })
    .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
  return (extra + "\n" + text).slice(0, 14000);
}

const TAGS = "dance, active, fitness, outdoors, creative, music, social, food, calm, adventure, games, night, hands-on, career, tech, talk, film, theatre";

async function extract(
  source: (typeof SOURCES)[number],
  apiKey: string,
  todayIso: string,
): Promise<LiveEvent[]> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "Mozilla/5.0 (Wayfare event aggregator)" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = htmlToText(await res.text(), source.url);

  const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You extract real, dated upcoming events from a web page. Today is ${todayIso} (Europe/London). Only include events with a specific date between today and 14 days from now. Never invent events or dates. If a time is unknown use 18:00. Default town: ${source.town}. Price 0 if free/unknown. Pick 1-4 tags from: ${TAGS}. url = the event or registration link if present, else the page URL.`,
        },
        { role: "user", content: `Page: ${source.url}\n\n${text}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_events",
            parameters: {
              type: "object",
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string", description: "One short sentence" },
                      startIso: { type: "string", description: "YYYY-MM-DDTHH:mm local time" },
                      durationMin: { type: "number" },
                      venue: { type: "string" },
                      town: { type: "string" },
                      priceGbp: { type: "number" },
                      tags: { type: "array", items: { type: "string" } },
                      url: { type: "string" },
                    },
                    required: ["title", "startIso", "venue", "town", "tags", "url"],
                  },
                },
              },
              required: ["events"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_events" } },
    }),
  });
  if (!ai.ok) throw new Error(`AI ${ai.status}`);
  const body = await ai.json();
  const args = body?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const parsed = JSON.parse(args ?? '{"events":[]}') as { events: Partial<LiveEvent>[] };
  return (parsed.events ?? [])
    .filter((e) => e.title && e.startIso && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(e.startIso))
    .map((e, i) => ({
      id: `${source.name}-${(e.startIso ?? "").slice(0, 10)}-${e.title}-${i * 0}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-0$/, ""),
      title: e.title!,
      description: e.description ?? "",
      startIso: e.startIso!.slice(0, 16),
      durationMin: e.durationMin && e.durationMin > 0 ? e.durationMin : 90,
      venue: e.venue || "TBC",
      town: e.town || source.town,
      priceGbp: Number(e.priceGbp) || 0,
      tags: e.tags ?? [],
      url: e.url || source.url,
      source: source.name,
    }));
}

async function refresh(): Promise<Snapshot> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI key missing");
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const results = await Promise.allSettled(SOURCES.map((s) => extract(s, apiKey, todayIso)));
  const events: LiveEvent[] = [];
  const sources: SourceStatus[] = results.map((r, i) => {
    const s = SOURCES[i]!;
    if (r.status === "fulfilled") {
      events.push(...r.value);
      return { name: s.name, url: s.url, ok: true, count: r.value.length };
    }
    return { name: s.name, url: s.url, ok: false, count: 0 };
  });
  // De-duplicate the same event listed by several sources
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const k = e.title.toLowerCase().replace(/\W/g, "") + e.startIso.slice(0, 10);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Archive every event we've seen so detail pages can show an organiser's past events.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("event_history").upsert(
      unique.map((e) => ({ id: e.id, title: e.title, source: e.source, venue: e.venue, town: e.town,
        start_iso: e.startIso, price_gbp: e.priceGbp, url: e.url, tags: e.tags })),
      { onConflict: "id", ignoreDuplicates: true },
    );
  } catch (err) { console.error("event_history archive failed", err); }
  return { at: Date.now(), events: unique, sources };
}

export const getLiveEvents = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  if (!inflight) {
    inflight = refresh()
      .then((c) => {
        cache = c;
        return c;
      })
      .finally(() => (inflight = null));
  }
  try {
    return await inflight;
  } catch {
    return cache ?? { at: Date.now(), events: [], sources: [] };
  }
});
