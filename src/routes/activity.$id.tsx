import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bus, Clock, ExternalLink, History, Loader2, MapPin, Sparkles, Users, Wallet } from "lucide-react";
import { ACTIVITIES, type Activity, type Journey } from "@/lib/activities";
import { getEmberJourneys } from "@/lib/ember.functions";
import { getLiveEvents } from "@/lib/live-events.functions";
import { toActivity } from "@/lib/live-activity";
import { buildJourney, formatTime } from "@/lib/recommend";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activity/$id")({
  head: () => ({
    meta: [
      { title: "Activity details — Wayfare" },
      { name: "description", content: "Organiser, past events, who's going and similar activities near you." },
      { property: "og:title", content: "Activity details — Wayfare" },
      { property: "og:description", content: "See the organiser, past events, who's going and similar activities." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DetailPage,
});

type Past = { id: string; title: string; start_iso: string; venue: string | null };

function londonNowMin() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return (Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24) * 60 + Number(p.find((x) => x.type === "minute")?.value ?? 0);
}

function DetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [pool, setPool] = useState<Activity[] | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const [going, setGoing] = useState(0);
  const [friends, setFriends] = useState<string[]>([]);
  const [mine, setMine] = useState(false);
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [emberBus, setEmberBus] = useState<Journey | null>(null);

  useEffect(() => {
    setNowMin(londonNowMin());
    getLiveEvents()
      .then((r) => setPool([...ACTIVITIES, ...r.events.map(toActivity).filter((a): a is Activity => !!a)]))
      .catch(() => setPool(ACTIVITIES));
  }, []);

  const a = pool?.find((x) => x.id === id);

  useEffect(() => {
    if (!a) return;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    supabase.from("event_history").select("id,title,start_iso,venue").eq("source", a.source).lt("start_iso", today)
      .order("start_iso", { ascending: false }).limit(6).then(({ data }) => setPast(data ?? []));
  }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same journey choice as the search results; link it only if it's an Ember bus.
  useEffect(() => {
    setEmberBus(null);
    if (!a?.ember || nowMin === null) return;
    const { destQuery, firstMileMin, lastMileMin } = a.ember;
    getEmberJourneys({ data: { requests: [{ destQuery, firstMileMin, lastMileMin, startMin: nowMin + a.startOffsetMin }], nowMin } })
      .then((r) => {
        const j = buildJourney(a, nowMin, r.journeys);
        setEmberBus([j, ...(j?.alternatives ?? [])].find((o) => o?.operator === "Ember" && o.bookingUrl) ?? null);
      })
      .catch(() => {});
  }, [a?.id, nowMin]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSocial = async () => {
    const c = await supabase.rpc("going_counts", { _ids: [id] });
    setGoing(Number(c.data?.[0]?.n ?? 0));
    if (user) {
      const [f, m] = await Promise.all([
        supabase.rpc("friends_going", { _ids: [id] }),
        supabase.from("attendance").select("activity_id").eq("user_id", user.id).eq("activity_id", id),
      ]);
      setFriends(f.data?.[0]?.names ?? []);
      setMine(!!m.data?.length);
    }
  };
  useEffect(() => { loadSocial(); }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    if (!user || !a) return;
    if (mine) await supabase.from("attendance").delete().eq("user_id", user.id).eq("activity_id", id);
    else await supabase.from("attendance").insert({ user_id: user.id, activity_id: id, activity_title: a.title });
    loadSocial();
  };

  if (!pool) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary-ink" /></div>;
  if (!a) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <p className="text-muted-foreground">This activity has finished or is no longer listed.</p>
      <Link to="/" className="text-primary-ink hover:underline">Back to search</Link>
    </div>
  );

  const fromOrganiser = pool.filter((x) => x.source === a.source && x.id !== a.id).slice(0, 4);
  const similar = pool
    .filter((x) => x.id !== a.id && x.source !== a.source)
    .map((x) => ({ x, n: x.tags.filter((t) => a.tags.includes(t)).length }))
    .filter((s) => s.n > 0).sort((p, q) => q.n - p.n || p.x.startOffsetMin - q.x.startOffsetMin).slice(0, 4).map((s) => s.x);
  const start = (nowMin ?? 0) + a.startOffsetMin;

  return (
    <div className="relative min-h-screen bg-background">
      <div className="route-grid pointer-events-none absolute inset-x-0 top-0 h-[360px]" />
      <div className="relative mx-auto max-w-3xl px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to results</Link>

        <div className="mt-8 flex flex-wrap gap-1.5">
          {a.tags.map((t) => <span key={t} className="rounded-full bg-accent/40 px-2.5 py-0.5 font-mono text-[10px] text-accent-ink capitalize">{t}</span>)}
          {a.live && <span className="rounded-full bg-primary/40 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary-ink uppercase">Live listing</span>}
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-balance">{a.title}</h1>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{a.dateLabel ? `${a.dateLabel} · ` : "Today · "}{nowMin === null ? "…" : `${formatTime(start)} – ${formatTime(start + a.durationMin)}`}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{a.venue}, {a.town}</span>
          <span className="inline-flex items-center gap-1.5"><Wallet className="size-4" />{a.priceGbp === 0 ? "Free" : `£${a.priceGbp}`}</span>
        </div>
        <p className="mt-5 leading-relaxed text-foreground/90">{a.description || "No description provided by the organiser."}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          {user ? (
            <button onClick={toggle} className={cn("rounded-full px-4 py-2 text-sm font-semibold", mine ? "bg-social text-social-foreground" : "bg-primary text-primary-foreground")}>{mine ? "✓ I'm going" : "I'm going"}</button>
          ) : <Link to="/auth" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Sign in to say you're going</Link>}
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="size-4" />{going} going</span>
          {friends.length > 0 && <span className="text-sm text-social-ink">Friends: {friends.join(", ")}</span>}
          {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-95">Learn more <ExternalLink className="size-4" /></a>}
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-accent-ink uppercase"><Bus className="size-3.5" /> Getting there with Ember</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {emberBus?.bookingUrl && emberBus.departMin != null && (
              <a href={emberBus.bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-95">
                Book the {formatTime(emberBus.departMin)} Ember bus{emberBus.pricePence != null ? ` · £${(emberBus.pricePence / 100).toFixed(2)}` : ""} <ExternalLink className="size-4" />
              </a>
            )}
            <a href="https://www.ember.to/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-ink hover:underline">ember.to <ExternalLink className="size-3.5" /></a>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-mono text-[10px] font-bold tracking-widest text-accent-ink uppercase">Organiser</h2>
          <p className="mt-2 font-display text-lg font-semibold">{a.source}</p>
          {fromOrganiser.length > 0 ? (
            <>
              <p className="mt-3 text-xs text-muted-foreground">Also coming up from this organiser</p>
              <ul className="mt-2 space-y-1.5">{fromOrganiser.map((x) => <MiniRow key={x.id} a={x} />)}</ul>
            </>
          ) : <p className="mt-2 text-xs text-muted-foreground">No other upcoming events from this organiser right now.</p>}
          <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><History className="size-3.5" /> Past events</p>
          {past.length > 0 ? (
            <ul className="mt-2 space-y-1.5">{past.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="text-foreground">{p.title}</span>
                <span className="shrink-0 font-mono text-muted-foreground">{new Date(p.start_iso + ":00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
              </li>
            ))}</ul>
          ) : <p className="mt-1 text-xs text-muted-foreground">We're keeping a record from now on. Past events from this organiser will build up here over time.</p>}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-accent-ink uppercase"><Sparkles className="size-3.5" /> Similar activities</h2>
          {similar.length ? <ul className="mt-3 space-y-1.5">{similar.map((x) => <MiniRow key={x.id} a={x} />)}</ul>
            : <p className="mt-2 text-xs text-muted-foreground">Nothing similar listed right now.</p>}
        </section>
      </div>
    </div>
  );
}

function MiniRow({ a }: { a: Activity }) {
  return (
    <li>
      <Link to="/activity/$id" params={{ id: a.id }} className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2 text-sm hover:text-accent-ink">
        <span className="font-semibold">{a.title}</span>
        <span className="truncate text-xs text-muted-foreground">{a.dateLabel ?? "Today"} · {a.town} · {a.priceGbp === 0 ? "Free" : `£${a.priceGbp}`}</span>
        <ArrowRight className="ml-auto size-3.5 shrink-0" />
      </Link>
    </li>
  );
}
