import type { Activity } from "./activities";
import type { LiveEvent } from "./live-events.functions";


// Minutes from now until a Europe/London local "YYYY-MM-DDTHH:mm".
export function londonOffsetMin(localIso: string): number {
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

export function toActivity(e: LiveEvent): Activity | null {
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
