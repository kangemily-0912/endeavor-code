import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bus, CalendarCheck, CalendarX, Clock, Footprints, Wallet, X } from "lucide-react";
import type { ScoredActivity } from "@/lib/recommend";
import { formatTime } from "@/lib/recommend";
import { coordsFor, REACH_META, reachState, TOWNS, type ReachState } from "@/lib/geo";
import { cn } from "@/lib/utils";

type Props = {
  results: ScoredActivity[];
  nowMin: number;
  origin: string;
  maxTravelMin: number | null;
  hasTimetable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

function icon(state: ReachState, selected: boolean, outside: boolean, minutes: string) {
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 40],
    html: `<div class="wf-pin wf-pin--${state}${selected ? " is-selected" : ""}${outside ? " is-outside" : ""}" role="img" aria-label="${REACH_META[state].label}"><span class="wf-pin__sym">${REACH_META[state].symbol}</span><span class="wf-pin__min">${minutes}</span></div>`,
  });
}

export default function ResultsMap({ results, nowMin, origin, maxTravelMin, hasTimetable, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Record<string, L.Marker>>({});
  const originLL = TOWNS[origin.toLowerCase()] ?? TOWNS["dundee"]!;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(originLL, 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18, className: "wf-tiles",
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on("click", () => onSelect(null));
    return () => { m.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw origin, reachable area and markers.
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current = {};
    if (maxTravelMin) {
      // ~0.7 km per minute of mixed bus + walking travel; an approximation of the reachable area.
      L.circle(originLL, { radius: maxTravelMin * 700, className: "wf-reach-area", interactive: false }).addTo(g);
    }
    L.marker(originLL, {
      icon: L.divIcon({ className: "", iconSize: [20, 20], iconAnchor: [10, 10], html: '<div class="wf-origin" aria-label="You are here"></div>' }),
      keyboard: false, interactive: false,
    }).addTo(g);
    const pts: L.LatLngExpression[] = [originLL];
    results.forEach((r) => {
      const ll = coordsFor(r.activity.town, r.activity.venue);
      pts.push(ll);
      const st = reachState(r, nowMin);
      const mins = r.journey ? `${r.journey.totalMin}′` : "—";
      const outside = !!maxTravelMin && (r.journey?.totalMin ?? 0) > maxTravelMin;
      const mk = L.marker(ll, { icon: icon(st, r.activity.id === selectedId, outside, mins), title: r.activity.title, riseOnHover: true, zIndexOffset: r.activity.id === selectedId ? 1000 : 0 })
        .on("click", (e) => { L.DomEvent.stopPropagation(e); onSelect(r.activity.id); })
        .addTo(g);
      markers.current[r.activity.id] = mk;
    });
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 12 });
  }, [results, maxTravelMin, nowMin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight + focus the selected marker.
  useEffect(() => {
    Object.entries(markers.current).forEach(([id, mk]) => {
      const r = results.find((x) => x.activity.id === id);
      if (!r) return;
      const outside = !!maxTravelMin && (r.journey?.totalMin ?? 0) > maxTravelMin;
      mk.setIcon(icon(reachState(r, nowMin), id === selectedId, outside, r.journey ? `${r.journey.totalMin}′` : "—"));
      mk.setZIndexOffset(id === selectedId ? 1000 : 0);
    });
    const sel = selectedId ? markers.current[selectedId] : null;
    if (sel && map.current) map.current.panTo(sel.getLatLng(), { animate: true });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    if (el.current) ro.observe(el.current);
    return () => ro.disconnect();
  }, []);

  const sel = results.find((r) => r.activity.id === selectedId) ?? null;

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div ref={el} className="absolute inset-0 z-0" aria-label="Map of activities by reachability" />

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex flex-col gap-1 rounded-2xl border border-border bg-card/95 p-2.5 text-[11px] text-foreground shadow-soft">
        {(Object.keys(REACH_META) as ReachState[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("wf-dot", `wf-pin--${k}`)}>{REACH_META[k].symbol}</span>
            {REACH_META[k].label}
          </span>
        ))}
        {maxTravelMin && (
          <span className="mt-1 inline-flex items-center gap-1.5 border-t border-border pt-1.5 text-muted-foreground">
            <span className="size-3 rounded-full border border-dashed border-reach-foreground bg-reach/50" />
            Within {maxTravelMin} min
          </span>
        )}
        <span className="text-muted-foreground">Numbers = minutes of travel</span>
      </div>

      {/* Selected preview */}
      {sel && (() => {
        const st = reachState(sel, nowMin);
        const j = sel.journey;
        const a = sel.activity;
        return (
          <div key={a.id} className="animate-rise-in absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-border bg-card p-4 text-foreground shadow-lift">
            <button onClick={() => onSelect(null)} aria-label="Close preview" className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase", `wf-chip--${st}`)}>
              {REACH_META[st].symbol} {REACH_META[st].label}
            </span>
            <h3 className="mt-1.5 pr-6 font-display text-base font-semibold leading-snug">{a.title}</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{a.dateLabel ? `${a.dateLabel} · ` : ""}Starts {formatTime(sel.startMin)}</span>
              <span className="inline-flex items-center gap-1"><Wallet className="size-3.5" />{a.priceGbp === 0 ? "Free" : `£${a.priceGbp}`}</span>
              <span className="inline-flex items-center gap-1"><Footprints className="size-3.5" />{j ? `${j.totalMin} min journey` : "No route found"}</span>
              <span className="inline-flex items-center gap-1 font-semibold">Leave by {j ? formatTime(j.leaveByMin) : "—"}</span>
              <span className="col-span-2 inline-flex items-center gap-1 text-accent-ink"><Bus className="size-3.5" />{j?.operator ?? (j ? j.legs.map((l) => l.label).join(" → ") : "—")}</span>
              <span className={cn("col-span-2 inline-flex items-center gap-1", sel.clash ? "text-destructive" : "text-reach-foreground")}>
                {sel.clash ? <CalendarX className="size-3.5" /> : <CalendarCheck className="size-3.5" />}
                {sel.clash ? `Clashes with ${sel.clash}` : hasTimetable ? "Fits your timetable" : "No timetable linked"}
              </span>
            </div>
            <Link to="/activity/$id" params={{ id: a.id }} className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]">
              Details <ArrowRight className="size-3.5" />
            </Link>
          </div>
        );
      })()}
    </div>
  );
}
