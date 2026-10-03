import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bus,
  Clock,
  Footprints,
  Loader2,
  MapPin,
  Sparkles,
  Train,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { ACTIVITIES, DEMO_LOCATION, type Journey } from "@/lib/activities";
import { getEmberJourneys } from "@/lib/ember.functions";
import { getLiveEvents, type LiveEvent, type SourceStatus } from "@/lib/live-events.functions";
import type { Activity } from "@/lib/activities";

// Minutes from now until a Europe/London local "YYYY-MM-DDTHH:mm".
function londonOffsetMin(localIso: string): number {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const g = (t: string) => Number(fmt.find((p) => p.type === t)?.value ?? 0);
  const nowLocal = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  const [d, t] = localIso.split("T");
  const [y, mo, da] = d!.split("-").map(Number);
  const [h, mi] = t!.split(":").map(Number);
  return Math.round((Date.UTC(y!, mo! - 1, da!, h!, mi!) - nowLocal) / 60000);
}

function toActivity(e: LiveEvent): Activity | null {
  const off = londonOffsetMin(e.startIso);
  if (off < 0) return null;
  const base = {
    id: "live-" + e.id, title: e.title, venue: e.venue, town: e.town, source: e.source,
    tags: e.tags, startOffsetMin: off, durationMin: e.durationMin, priceGbp: e.priceGbp,
    spacesLeft: 20, description: e.description, url: e.url, live: true,
    dateLabel: off > 18 * 60 || londonOffsetMin(e.startIso.slice(0, 10) + "T00:00") > 0
      ? new Date(e.startIso + ":00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
      : undefined,
  };
  if (/st\.? andrews/i.test(e.town)) {
    return { ...base, fallbackJourney: { leaveOffsetMin: off - 60, totalMin: 50, legs: [
      { mode: "walk", label: "Walk to Dundee bus station", durationMin: 6 },
      { mode: "bus", label: "Stagecoach 99 → St Andrews", durationMin: 38 },
      { mode: "walk", label: `Walk to ${e.venue}`, durationMin: 6 },
    ] } };
  }
  return { ...base, walkMin: 15 };
}
import { formatTime, recommend, type ScoredActivity } from "@/lib/recommend";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wayfare — Discover locally. Decide instantly. Get there easily." },
      {
        name: "description",
        content:
          "Tell Wayfare what you feel like doing. We find local activities you can actually reach in time — with live Ember journeys built in.",
      },
      { property: "og:title", content: "Wayfare — Real-time local discovery & transport" },
      {
        property: "og:description",
        content:
          "Turn “what do I feel like doing?” into “here's something you'll enjoy — and here's how to get there.”",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const EXAMPLE_INTENTS = [
  "I want to dance this afternoon",
  "I have three hours free. What can I do?",
  "Is there anything creative happening tonight?",
  "Something outdoors, under 40 minutes away",
];

function londonNowMin(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function Index() {
  const [query, setQuery] = useState("");
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [results, setResults] = useState<ScoredActivity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(true);

  // Pull aggregated events from the watched pages (server refreshes hourly).
  useEffect(() => {
    const load = () =>
      getLiveEvents()
        .then((r) => { setLiveEvents(r.events); setSources(r.sources); setSyncedAt(r.at); })
        .catch(() => {})
        .finally(() => setSyncing(false));
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => clearInterval(t);
  }, []);

  // Clock starts on the client only, to avoid SSR hydration mismatch.
  useEffect(() => {
    setNowMin(londonNowMin());
    const t = setInterval(() => setNowMin(londonNowMin()), 30_000);
    return () => clearInterval(t);
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim() || nowMin === null) return;
    setQuery(q);
    setLoading(true);
    setResults(null);

    // Ask the live Ember API for journeys to every remote destination.
    const requests = ACTIVITIES.filter((a) => a.ember).map((a) => ({
      destQuery: a.ember!.destQuery,
      firstMileMin: a.ember!.firstMileMin,
      lastMileMin: a.ember!.lastMileMin,
      startMin: nowMin + a.startOffsetMin,
    }));

    let liveJourneys: Record<string, Journey | null> = {};
    try {
      const res = await getEmberJourneys({ data: { requests, nowMin } });
      liveJourneys = res.journeys;
    } catch {
      // API unreachable — remote activities simply rank as unreachable
    }

    setLiveCount(Object.values(liveJourneys).filter(Boolean).length);
    const pool = [...ACTIVITIES, ...liveEvents.map(toActivity).filter((a): a is Activity => !!a)];
    setResults(recommend(q, nowMin, liveJourneys, pool));
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="route-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <MapPin className="size-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Wayfare</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 font-mono text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent animate-pulse-dot" />
          {DEMO_LOCATION} · {nowMin === null ? "…" : formatTime(nowMin)}
        </div>
      </header>

      {/* Hero / intent input */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-14 pb-10 text-center">
        <p className="mb-4 font-mono text-xs tracking-[0.25em] text-accent uppercase">
          Intent → Discovery → Decision → Journey
        </p>
        <h1 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
          What do you feel like doing?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          We find local activities you can{" "}
          <em className="text-foreground not-italic font-semibold">actually reach in time</em> —
          with live Ember bus journeys built into every recommendation.
        </p>

        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
        >
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-black/40 focus-within:border-ring">
            <Sparkles className="ml-3 size-5 shrink-0 text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="I want to dance this afternoon…"
              className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={loading || nowMin === null}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Go"}
              {!loading && <ArrowRight className="size-4" />}
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLE_INTENTS.map((intent) => (
            <button
              key={intent}
              onClick={() => runSearch(intent)}
              className="rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-accent hover:text-accent"
            >
              {intent}
            </button>
          ))}
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-primary" />
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Checking live Ember departures from {DEMO_LOCATION}…
          </p>
        </section>
      )}

      {/* Results */}
      {results && !loading && (
        <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">
              Ranked by{" "}
              <span className="font-mono text-sm text-accent">
                interest × time × reachability × availability
              </span>
            </h2>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {results.filter((r) => r.reachable).length} reachable · {liveCount} live Ember
              journeys
            </span>
          </div>

          <div className="space-y-4">
            {results.slice(0, 6).map((r, i) => (
              <ResultCard key={r.activity.id} result={r} rank={i + 1} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Live sources strip */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-8">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-muted-foreground">
              <span className="text-foreground font-semibold">{liveEvents.length}</span> live events from{" "}
              {sources.filter((s) => s.ok).length}/{sources.length || "…"} watched pages
            </p>
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              {syncing ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1.5 rounded-full bg-accent" />}
              {syncing ? "Reading society & venue pages…" : syncedAt ? `Synced ${new Date(syncedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · refreshes hourly` : ""}
            </p>
          </div>
          {sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer"
                  className={cn("rounded-full border px-2.5 py-1 font-mono text-[10px]",
                    s.ok ? "border-border text-foreground hover:border-primary" : "border-border text-muted-foreground line-through opacity-60")}>
                  {s.name} {s.ok && <span className="text-accent">· {s.count}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works — shown before first search */}
      {!results && !loading && (
        <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Say what you feel like",
              body: "No categories, no filters. “I want to dance this afternoon” is enough.",
            },
            {
              step: "02",
              title: "We check what's real",
              body: "Activities aggregated from Eventbrite, Instagram, societies and local venues — structured and matched to your intent.",
            },
            {
              step: "03",
              title: "Live transport decides the rank",
              body: "We query the real Ember API for the next departures. An amazing event you can't reach in time shouldn't top your list.",
            },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-border bg-card p-6">
              <span className="font-mono text-xs text-primary">{s.step}</span>
              <h3 className="mt-2 font-display font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
          <p className="sm:col-span-3 pt-4 text-center font-mono text-xs text-muted-foreground">
            Discover locally. Decide instantly. Get there easily.
          </p>
        </section>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 0.75 ? "bg-accent" : value >= 0.4 ? "bg-primary" : "bg-destructive",
          )}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function LegIcon({ mode }: { mode: "walk" | "bus" | "train" }) {
  if (mode === "bus") return <Bus className="size-3.5" />;
  if (mode === "train") return <Train className="size-3.5" />;
  return <Footprints className="size-3.5" />;
}

function ResultCard({
  result,
  rank,
  index,
}: {
  result: ScoredActivity;
  rank: number;
  index: number;
}) {
  const [open, setOpen] = useState(rank === 1);
  const { activity: a, journey } = result;
  const isTop = rank === 1 && result.reachable;

  return (
    <article
      className={cn(
        "animate-rise-in overflow-hidden rounded-2xl border bg-card",
        isTop ? "border-primary/60 shadow-[0_0_40px_-12px] shadow-primary/30" : "border-border",
        !result.reachable && "opacity-60",
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        {/* Score */}
        <div
          className={cn(
            "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl font-mono",
            isTop ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          <span className="text-lg font-bold leading-none">{result.score}</span>
          <span className="text-[9px] uppercase opacity-70">score</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isTop && (
              <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
                Best option
              </span>
            )}
            {!result.reachable && (
              <span className="rounded-full bg-destructive/20 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-destructive uppercase">
                Not reachable in time
              </span>
            )}
            {journey?.live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-accent uppercase">
                <Zap className="size-3" /> Live Ember
              </span>
            )}
            {a.live && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-primary uppercase">
                Live listing
              </span>
            )}
            <span className="font-mono text-[10px] text-muted-foreground">{a.source}</span>
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{a.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {a.dateLabel ? `${a.dateLabel} · ` : ""}
              {formatTime(result.startMin)} – {formatTime(result.endMin)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {a.venue}, {a.town}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet className="size-3.5" />
              {a.priceGbp === 0 ? "Free" : `£${a.priceGbp}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {a.live ? "Sign-up open" : `${a.spacesLeft} spaces left`}
            </span>
            {a.url && (
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                Sign up <ArrowRight className="size-3.5" />
              </a>
            )}
          </div>
        </div>

        <ArrowRight
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="grid gap-5 border-t border-border p-5 sm:grid-cols-2">
          {/* Journey */}
          <div>
            <h4 className="mb-3 font-mono text-[10px] font-bold tracking-widest text-accent uppercase">
              Getting there
            </h4>
            {result.reachable && journey ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Leave by</span>
                  <span className="font-mono font-bold text-primary">
                    {formatTime(journey.leaveByMin)}
                  </span>
                  <span className="text-muted-foreground">
                    · arrive {formatTime(result.arriveByMin)}
                  </span>
                  {journey.live && journey.pricePence != null && (
                    <span className="ml-auto font-mono text-accent">
                      £{(journey.pricePence / 100).toFixed(2)} · {journey.seatsLeft ?? "–"} seats
                    </span>
                  )}
                </div>
                <ol className="relative space-y-3 border-l border-border pl-5">
                  {journey.legs.map((leg, i) => (
                    <li key={i} className="relative text-xs">
                      <span className="absolute -left-[26px] flex size-4 items-center justify-center rounded-full bg-muted text-accent">
                        <LegIcon mode={leg.mode} />
                      </span>
                      <span className="text-foreground">{leg.label}</span>
                      <span className="ml-2 font-mono text-muted-foreground">
                        {leg.durationMin} min
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No departure from {DEMO_LOCATION} gets you there before it starts — this option is
                ranked down automatically.
              </p>
            )}
          </div>

          {/* Score breakdown */}
          <div>
            <h4 className="mb-3 font-mono text-[10px] font-bold tracking-widest text-accent uppercase">
              Why this rank
            </h4>
            <div className="space-y-2.5">
              <ScoreBar label="Interest" value={result.interestMatch} />
              <ScoreBar label="Time fit" value={result.timeFit} />
              <ScoreBar label="Reachable" value={result.reachability} />
              <ScoreBar label="Available" value={result.availability} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
            {result.matchedTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.matchedTags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
