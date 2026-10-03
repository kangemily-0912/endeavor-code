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

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function coordsFor(town: string, venue: string): [number, number] {
  const key = Object.keys(TOWNS).find((k) => town.toLowerCase().includes(k)) ?? "dundee";
  const [lat, lng] = TOWNS[key]!;
  const h = hash(venue + town);
  const dLat = ((h & 0xff) / 255 - 0.5) * 0.012;
  const dLng = (((h >> 8) & 0xff) / 255 - 0.5) * 0.02;
  return [lat + dLat, lng + dLng];
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
