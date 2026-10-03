// Approximate coordinates for map display. Activities only carry a town + venue,
// so we place them near the town centre with a stable per-venue offset.
import type { ScoredActivity } from "@/lib/recommend";

export const TOWNS: Record<string, [number, number]> = {
  dundee: [56.4620, -2.9707],
  "st andrews": [56.3398, -2.7967],
  edinburgh: [55.9533, -3.1883],
  glasgow: [55.8642, -4.2518],
  perth: [56.3950, -3.4308],
  stirling: [56.1165, -3.9369],
  aberdeen: [57.1497, -2.0943],
};

// Verified coordinates for known venues (highest priority).
const KNOWN: Record<string, [number, number]> = {
  "dance base studio|edinburgh": [55.9476, -3.1953],
  "the reading rooms|dundee": [56.4627, -2.9684],
  "the pitt market|edinburgh": [55.976, -3.1745],
  "king tut's wah wah hut|glasgow": [55.8625, -4.2647],
  "dundee contemporary arts, studio 3|dundee": [56.4572, -2.9744],
  "clarks on lindsay street|dundee": [56.4615, -2.9744],
  "north inch park|perth": [56.404, -3.428],
  "west sands beach|st andrews": [56.348, -2.809],
};

export const venueKey = (venue: string, town: string) => `${venue}|${town}`.toLowerCase();
export const knownVenue = (venue: string, town: string) => KNOWN[venueKey(venue, town)] ?? null;

export function townCentre(town: string): [number, number] {
  const key = Object.keys(TOWNS).find((k) => town.toLowerCase().includes(k)) ?? "dundee";
  return TOWNS[key]!;
}

export type Loc = { ll: [number, number]; approx: boolean };

export function locate(venue: string, town: string, geocoded: Record<string, { lat: number; lng: number } | null>): Loc {
  const k = knownVenue(venue, town);
  if (k) return { ll: k, approx: false };
  const g = geocoded[venueKey(venue, town)];
  if (g) return { ll: [g.lat, g.lng], approx: false };
  return { ll: townCentre(town), approx: true };
}

export type ReachState = "easy" | "soon" | "later" | "unfit";

export const REACH_META: Record<ReachState, { label: string; symbol: string; hint: string }> = {
  easy: { label: "Easy to reach", symbol: "✓", hint: "Plenty of time to get there" },
  soon: { label: "Leave soon", symbol: "!", hint: "Reachable, but leave within 30 min" },
  later: { label: "Later", symbol: "◷", hint: "Starts later or on another day" },
  unfit: { label: "Doesn't fit", symbol: "✕", hint: "Travel time or timetable clash" },
};

export function reachState(r: ScoredActivity, nowMin: number): ReachState {
  if (!r.reachable || r.clash) return "unfit";
  const leave = r.journey?.leaveByMin ?? r.startMin;
  if (r.activity.dateLabel || r.startMin - nowMin > 240) return "later";
  if (leave - nowMin <= 30) return "soon";
  return "easy";
}
