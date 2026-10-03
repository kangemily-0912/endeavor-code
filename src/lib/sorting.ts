import type { ScoredActivity } from "./recommend";
import type { Profile } from "@/hooks/use-auth";

export const CATEGORIES = ["dance", "active", "fitness", "outdoors", "creative", "music", "social", "food", "calm", "adventure", "games", "hands-on"];

export type SortKey = "best" | "distance" | "popular" | "friends" | "time" | "category" | "price" | "organiser";
export const SORTS: { key: SortKey; label: string }[] = [
  { key: "best", label: "Best match" },
  { key: "distance", label: "Distance" },
  { key: "popular", label: "Most going" },
  { key: "friends", label: "Friends going" },
  { key: "time", label: "Date / time" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price" },
  { key: "organiser", label: "Organiser" },
];

export type Social = { counts: Record<string, number>; friends: Record<string, string[]> };

// Personal preferences nudge the score: favourite categories up, over-budget or too-far down.
export function applyPreferences(list: ScoredActivity[], p: Profile | null): ScoredActivity[] {
  if (!p) return list;
  return list.map((r) => {
    let s = r.score;
    if (r.activity.tags.some((t) => p.fav_categories.includes(t))) s *= 1.25;
    if (p.max_budget != null && r.activity.priceGbp > Number(p.max_budget)) s *= 0.3;
    if (p.max_travel_min != null && (r.journey?.totalMin ?? 0) > p.max_travel_min) s *= 0.3;
    return { ...r, score: Math.min(100, Math.round(s)) };
  }).sort((a, b) => b.score - a.score);
}

export function sortResults(list: ScoredActivity[], key: SortKey, social: Social): ScoredActivity[] {
  const reach = (r: ScoredActivity) => (r.reachable ? 0 : 1); // reachable first in every sort
  const by = (f: (r: ScoredActivity) => number | string) =>
    [...list].sort((a, b) => {
      const d = reach(a) - reach(b);
      if (d) return d;
      const x = f(a), y = f(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) || b.score - a.score;
    });
  switch (key) {
    case "distance": return by((r) => r.journey?.totalMin ?? 999);
    case "popular": return by((r) => -(social.counts[r.activity.id] ?? 0));
    case "friends": return by((r) => -(social.friends[r.activity.id]?.length ?? 0));
    case "time": return by((r) => r.startMin);
    case "category": return by((r) => r.activity.tags[0] ?? "zzz");
    case "price": return by((r) => r.activity.priceGbp);
    case "organiser": return by((r) => r.activity.source.toLowerCase());
    default: return list;
  }
}
