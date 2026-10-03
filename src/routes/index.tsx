import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarX,
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
import { getTimetable, type BusyBlock } from "@/lib/timetable.functions";
import { londonOffsetMin, toActivity } from "@/lib/live-activity";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { applyPreferences, sortResults, SORTS, type Social, type SortKey } from "@/lib/sorting";

const TT_KEY = "wayfare.timetable";

// Demo timetable relative to now, so judges can see clash-avoidance instantly.
function demoTimetable(): BusyBlock[] {
  const at = (offMin: number) => {
    const d = new Date(Date.now() + offMin * 60000);
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}T${String(Number(g("hour")) % 24).padStart(2, "0")}:${g("minute")}`;
  };
  return [
    { title: "CS2001 Lecture", start: at(90), end: at(150) },
    { title: "MT1002 Tutorial", start: at(300), end: at(360) },
    { title: "CS2003 Lab", start: at(24 * 60 + 60), end: at(24 * 60 + 180) },
  ];
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
  const [tt, setTt] = useState<{ url: string; blocks: BusyBlock[] } | null>(null);
  const [ignoreTt, setIgnoreTt] = useState(false);
  const { user } = useAuth();
  const { profile, save: saveProfile } = useProfile(user?.id);
  const [sortKey, setSortKey] = useState<SortKey>("best");
  const [social, setSocial] = useState<Social>({ counts: {}, friends: {} });
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TT_KEY);
      if (raw) setTt(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  const saveTt = (v: { url: string; blocks: BusyBlock[] } | null) => {
    setTt(v);
    if (v) localStorage.setItem(TT_KEY, JSON.stringify(v));
    else localStorage.removeItem(TT_KEY);
    if (user && (v === null || v.url !== "demo")) saveProfile({ timetable_url: v?.url ?? null });
  };

  // Signed-in users get their saved timetable on any device.
  useEffect(() => {
    const url = profile?.timetable_url;
    if (!url || (tt && tt.url === url)) return;
    getTimetable({ data: { url } }).then((r) => {
      setTt({ url, blocks: r.blocks });
      localStorage.setItem(TT_KEY, JSON.stringify({ url, blocks: r.blocks }));
    }).catch(() => {});
  }, [profile?.timetable_url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who's going: public counts + friends (signed in).
  const loadSocial = async (ids: string[]) => {
    if (!ids.length) return;
    const [c, f, m] = await Promise.all([
      supabase.rpc("going_counts", { _ids: ids }),
      user ? supabase.rpc("friends_going", { _ids: ids }) : Promise.resolve({ data: [] }),
      user ? supabase.from("attendance").select("activity_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    setSocial({
      counts: Object.fromEntries((c.data ?? []).map((r: { activity_id: string; n: number }) => [r.activity_id, Number(r.n)])),
      friends: Object.fromEntries((f.data ?? []).map((r: { activity_id: string; names: string[] }) => [r.activity_id, r.names])),
    });
    setMine(new Set((m.data ?? []).map((r: { activity_id: string }) => r.activity_id)));
  };
  useEffect(() => { if (results) loadSocial(results.map((r) => r.activity.id)); }, [results, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGoing = async (id: string, title: string) => {
    if (!user) return;
    if (mine.has(id)) await supabase.from("attendance").delete().eq("user_id", user.id).eq("activity_id", id);
    else await supabase.from("attendance").insert({ user_id: user.id, activity_id: id, activity_title: title });
    if (results) loadSocial(results.map((r) => r.activity.id));
  };

  // Pull aggregated events from the watched pages (server refreshes hourly).
  useEffect(() => {
    const load = () =>
      getLiveEvents()
        .then((r) => { if (!r) return; setLiveEvents(r.events); setSources(r.sources); setSyncedAt(r.at); })
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

    let liveJourneys: Record<string, Journey[]> = {};
    try {
      const res = await getEmberJourneys({ data: { requests, nowMin } });
      liveJourneys = res.journeys;
    } catch {
      // API unreachable — remote activities simply rank as unreachable
    }

    setLiveCount(Object.values(liveJourneys).filter((l) => l.length).length);
    const pool = [...ACTIVITIES, ...liveEvents.map(toActivity).filter((a): a is Activity => !!a)];
    let ranked = recommend(q, nowMin, liveJourneys, pool);
    if (tt && !ignoreTt) {
      const blocks = tt.blocks.map((b) => ({ title: b.title, s: londonOffsetMin(b.start), e: londonOffsetMin(b.end) }));
      ranked = ranked
        .map((r) => {
          const from = (r.journey?.leaveByMin ?? r.startMin) - nowMin;
          const to = r.endMin - nowMin + (r.journey?.totalMin ?? 0); // include getting back
          const hit = blocks.find((b) => b.s < to && b.e > from);
          return hit ? { ...r, clash: hit.title, score: Math.round(r.score * 0.1) } : r;
        })
        .sort((a, b) => b.score - a.score);
    }
    setResults(ranked);
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent animate-pulse-dot" />
            {DEMO_LOCATION} · {nowMin === null ? "…" : formatTime(nowMin)}
          </div>
          {user ? (
            <Link to="/profile" className="rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold hover:text-accent-ink">
              {profile?.display_name ?? "Profile"}
            </Link>
          ) : (
            <Link to="/auth" className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">Sign in</Link>
          )}
        </div>
      </header>

      {/* Hero / intent input */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-14 pb-10 text-center">
        <p className="mb-4 font-mono text-xs tracking-[0.25em] text-accent-ink uppercase">
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
            <Sparkles className="ml-3 size-5 shrink-0 text-primary-ink" />
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
              className="rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-accent-ink hover:text-accent-ink"
            >
              {intent}
            </button>
          ))}
        </div>
      </section>

      {/* Timetable */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-8">
        <TimetablePanel tt={tt} onSave={saveTt} ignore={ignoreTt} setIgnore={setIgnoreTt} onChange={() => results && runSearch(query)} />
      </section>


      {/* Loading */}
      {loading && (
        <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-primary-ink" />
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Checking live Ember departures from {DEMO_LOCATION}…
          </p>
        </section>
      )}

      {/* Results */}
      {results && !loading && (
        <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Sort by</h2>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {results.filter((r) => r.reachable).length} reachable · {liveCount} live Ember
              journeys
            </span>
          </div>
          <div className="mb-6 flex flex-wrap gap-1.5">
            {SORTS.map((s) => (
              <button key={s.key} onClick={() => setSortKey(s.key)}
                className={cn("rounded-full border px-3 py-1 text-xs", sortKey === s.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                {s.label}
              </button>
            ))}
            {sortKey === "friends" && !user && <Link to="/auth" className="px-2 py-1 text-xs text-social-ink">Sign in to see friends</Link>}
          </div>

          <div className="space-y-4">
            {sortResults(applyPreferences(results, profile), sortKey, social).slice(0, 8).map((r, i) => (
              <ResultCard key={r.activity.id} result={r} rank={i + 1} index={i} nowMin={nowMin ?? 0}
                going={social.counts[r.activity.id] ?? 0} friends={social.friends[r.activity.id] ?? []}
                isMine={mine.has(r.activity.id)} signedIn={!!user} onGoing={() => toggleGoing(r.activity.id, r.activity.title)} />
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
                  {s.name} {s.ok && <span className="text-accent-ink">· {s.count}</span>}
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
              <span className="font-mono text-xs text-primary-ink">{s.step}</span>
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

function dueLabel(depMin: number, nowMin: number) {
  const d = depMin - nowMin;
  if (d <= 0) return "due now";
  if (d < 60) return `in ${d} min`;
  return `in ${Math.floor(d / 60)}h ${d % 60}m`;
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
  nowMin,
  going,
  friends,
  isMine,
  signedIn,
  onGoing,
}: {
  result: ScoredActivity;
  rank: number;
  index: number;
  nowMin: number;
  going: number;
  friends: string[];
  isMine: boolean;
  signedIn: boolean;
  onGoing: () => void;
}) {
  const [open, setOpen] = useState(rank === 1);
  const { activity: a, journey } = result;
  const isTop = rank === 1 && result.reachable;
  const goingRow = (
    <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-2.5 text-xs">
      {signedIn ? (
        <button onClick={onGoing} className={cn("rounded-full px-3 py-1 font-semibold", isMine ? "bg-social text-social-foreground" : "border border-border hover:border-social-ink")}>
          {isMine ? "✓ I'm going" : "I'm going"}
        </button>
      ) : (
        <Link to="/auth" className="rounded-full border border-border px-3 py-1 hover:border-accent-ink">Sign in to say you're going</Link>
      )}
      <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="size-3.5" /> {going} going</span>
      {friends.length > 0 && <span className="text-social-ink">Friends: {friends.slice(0, 3).join(", ")}{friends.length > 3 ? ` +${friends.length - 3}` : ""}</span>}
      <Link to="/activity/$id" params={{ id: a.id }} className="ml-auto inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline">
        Details <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );

  return (
    <article
      className={cn(
        "animate-rise-in overflow-hidden rounded-3xl border bg-card shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        isTop ? "border-primary-ink/40 shadow-lift ring-4 ring-primary/40" : "border-border",
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
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-destructive uppercase">
                Not reachable in time
              </span>
            )}
            {journey?.live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-accent-ink uppercase">
                <Zap className="size-3" /> {journey.realtime ? "Live tracking" : "Live Ember"}
              </span>
            )}
            {result.reachable && journey?.departMin != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-reach px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-reach-foreground uppercase">
                <Bus className="size-3" /> {journey.operator} {dueLabel(journey.departMin, nowMin)}
              </span>
            )}
            {result.clash && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-destructive uppercase">
                <CalendarX className="size-3" /> Clashes with {result.clash}
              </span>
            )}
            {a.live && (
              <span className="rounded-full bg-primary/40 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-primary-ink uppercase">
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
                className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
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
      {goingRow}

      {open && (
        <div className="grid gap-5 border-t border-border p-5 sm:grid-cols-2">
          {/* Journey */}
          <div>
            <h4 className="mb-3 font-mono text-[10px] font-bold tracking-widest text-accent-ink uppercase">
              Getting there
            </h4>
            {result.reachable && journey ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Leave by</span>
                  <span className="font-mono font-bold text-primary-ink">
                    {formatTime(journey.leaveByMin)}
                  </span>
                  <span className="text-muted-foreground">
                    · arrive {formatTime(result.arriveByMin)}
                  </span>
                  {journey.live && journey.pricePence != null && (
                    <span className="ml-auto font-mono text-accent-ink">
                      £{(journey.pricePence / 100).toFixed(2)} · {journey.seatsLeft ?? "–"} seats
                    </span>
                  )}
                </div>
                <ol className="relative space-y-3 border-l border-border pl-5">
                  {journey.legs.map((leg, i) => (
                    <li key={i} className="relative text-xs">
                      <span className="absolute -left-[26px] flex size-4 items-center justify-center rounded-full bg-muted text-accent-ink">
                        <LegIcon mode={leg.mode} />
                      </span>
                      <span className="text-foreground">{leg.label}</span>
                      <span className="ml-2 font-mono text-muted-foreground">
                        {leg.durationMin} min
                      </span>
                    </li>
                  ))}
                </ol>
                {journey.departMin != null && (
                  <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                    {journey.realtime ? "● Live: " : "Timetable: "}
                    {journey.operator} departs {formatTime(journey.departMin)} ({dueLabel(journey.departMin, nowMin)})
                    {journey.realtime && journey.delayMin ? ` · ${journey.delayMin > 0 ? journey.delayMin + " min late" : -journey.delayMin + " min early"}` : ""}
                  </p>
                )}
                {!!journey.alternatives?.length && (
                  <div className="mt-4">
                    <h5 className="mb-2 font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                      Other buses
                    </h5>
                    <ul className="space-y-1.5">
                      {journey.alternatives.map((alt, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-x-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                          <span className="font-semibold text-foreground">{alt.operator}</span>
                          <span className="font-mono text-primary-ink">{dueLabel(alt.departMin ?? alt.leaveByMin, nowMin)}</span>
                          <span className="font-mono text-muted-foreground">
                            dep {formatTime(alt.departMin ?? alt.leaveByMin)} → arr {formatTime(alt.arriveMin ?? alt.leaveByMin + alt.totalMin)}
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground uppercase">
                            {alt.realtime ? "● live" : alt.live ? "Ember" : "timetable"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
            <h4 className="mb-3 font-mono text-[10px] font-bold tracking-widest text-accent-ink uppercase">
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
                    className="rounded-full bg-accent/40 px-2 py-0.5 font-mono text-[10px] text-accent-ink"
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

function TimetablePanel({
  tt, onSave, ignore, setIgnore, onChange,
}: {
  tt: { url: string; blocks: BusyBlock[] } | null;
  onSave: (v: { url: string; blocks: BusyBlock[] } | null) => void;
  ignore: boolean;
  setIgnore: (v: boolean) => void;
  onChange: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { onChange(); /* re-rank when timetable changes */ }, [tt, ignore]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await getTimetable({ data: { url } });
      onSave({ url, blocks: r.blocks }); setOpen(false); setUrl("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that calendar");
    } finally { setBusy(false); }
  };

  const upcoming = tt?.blocks.filter((b) => b.end > new Date().toISOString().slice(0, 16)).slice(0, 3) ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
            <CalendarCheck className="size-4 text-accent-ink" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold">
              {tt ? `Timetable connected · ${tt.blocks.length} classes in the next 2 weeks` : "Add your class timetable"}
            </p>
            <p className="text-xs text-muted-foreground">
              {tt ? (ignore ? "Ignoring your timetable for this search" : "We'll steer you away from anything that clashes with class") : "Link your Outlook calendar so we never suggest something during class"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tt && (
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">
              <input type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} className="accent-primary" />
              Ignore timetable
            </label>
          )}
          {tt ? (
            <button onClick={() => onSave(null)} className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Remove</button>
          ) : (
            <>
              <button onClick={() => setOpen((o) => !o)} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">Connect Outlook</button>
              <button onClick={() => onSave({ url: "demo", blocks: demoTimetable() })} className="rounded-full border border-border px-3 py-1.5 text-xs">Try demo timetable</button>
            </>
          )}
        </div>
      </div>

      {tt && !ignore && upcoming.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {upcoming.map((b) => (
            <span key={b.start + b.title} className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[10px] text-secondary-foreground">
              {b.title} · {new Date(b.start + ":00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} {b.start.slice(11)}–{b.end.slice(11)}
            </span>
          ))}
        </div>
      )}

      {open && !tt && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Open Outlook on the web → Settings → Calendar → Shared calendars</li>
            <li>Under “Publish a calendar”, pick your calendar, choose “Can view all details”, click Publish</li>
            <li>Copy the <span className="text-foreground">ICS</span> link and paste it below</li>
          </ol>
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring" />
            <button disabled={busy || url.length < 8} onClick={connect}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {busy && <Loader2 className="size-3 animate-spin" />} Link
            </button>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      )}
    </div>
  );
}
