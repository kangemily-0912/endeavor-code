import { useEffect, useState } from "react";
import type { Activity } from "./activities";
import type { ScoredActivity } from "./recommend";

// Saved ("liked") activities live in browser localStorage, with what the user liked about each.
export type LikeReason = "venue" | "duration" | "organiser" | "category" | "price" | "time";
export const LIKE_REASONS: { key: LikeReason; label: string }[] = [
  { key: "category", label: "The type of activity" },
  { key: "venue", label: "The place" },
  { key: "organiser", label: "The organiser" },
  { key: "duration", label: "How long it lasts" },
  { key: "price", label: "The price" },
  { key: "time", label: "The time of day" },
];

export type Like = {
  id: string; title: string; reasons: LikeReason[];
  venue: string; source: string; tags: string[]; durationMin: number; priceGbp: number; startHour: number;
};

const KEY = "wayfare.likes";
const EVT = "wayfare-likes";

function read(): Record<string, Like> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function write(v: Record<string, Like>) {
  localStorage.setItem(KEY, JSON.stringify(v));
  window.dispatchEvent(new Event(EVT));
}

export function saveLike(a: Activity, startMin: number, reasons: LikeReason[]) {
  const all = read();
  all[a.id] = {
    id: a.id, title: a.title, reasons, venue: a.venue, source: a.source, tags: a.tags,
    durationMin: a.durationMin, priceGbp: a.priceGbp, startHour: Math.floor(startMin / 60),
  };
  write(all);
}
export function removeLike(id: string) { const all = read(); delete all[id]; write(all); }

export function useLikes(): Record<string, Like> {
  const [v, setV] = useState<Record<string, Like>>({});
  useEffect(() => {
    const sync = () => setV(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return v;
}

const norm = (s: string) => (s.toLowerCase().split(",")[0] ?? "").trim();

// Returns which saved likes this activity resembles, based on the reasons the user gave.
export function likeMatch(r: ScoredActivity, likes: Like[]): string | null {
  const a = r.activity;
  for (const l of likes) {
    if (l.id === a.id) continue;
    for (const k of l.reasons) {
      if (k === "venue" && norm(l.venue) === norm(a.venue)) return `Same place as “${l.title}”`;
      if (k === "organiser" && l.source.toLowerCase() === a.source.toLowerCase()) return `Same organiser as “${l.title}”`;
      if (k === "category" && a.tags.some((t) => l.tags.includes(t))) return `Similar to “${l.title}”`;
      if (k === "duration" && Math.abs(l.durationMin - a.durationMin) <= 30) return `Similar length to “${l.title}”`;
      if (k === "price" && a.priceGbp <= l.priceGbp + 2) return `Similar price to “${l.title}”`;
      if (k === "time" && Math.abs(l.startHour - Math.floor(r.startMin / 60)) <= 1) return `Same time of day as “${l.title}”`;
    }
  }
  return null;
}

// Nudge activities that resemble a saved like up the ranking.
export function applyLikes(list: ScoredActivity[], likes: Record<string, Like>): ScoredActivity[] {
  const arr = Object.values(likes);
  if (!arr.length) return list;
  return list
    .map((r) => (likeMatch(r, arr) ? { ...r, score: Math.min(100, Math.round(r.score * 1.2)) } : r))
    .sort((a, b) => b.score - a.score);
}
