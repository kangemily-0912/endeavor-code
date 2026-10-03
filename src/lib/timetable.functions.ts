import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// A busy block in Europe/London local time, "YYYY-MM-DDTHH:mm".
export type BusyBlock = { title: string; start: string; end: string };

const WINDOW_DAYS = 14;

function unfold(ics: string): string[] {
  return ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function londonParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${String(Number(g("hour")) % 24).padStart(2, "0")}:${g("minute")}`;
}

// Parse an ICS date into a "naive local" Date (UTC fields = London wall clock).
function parseIcsDate(prop: string, value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", , z] = m;
  if (z) {
    // True UTC → convert to London wall clock
    const real = new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi));
    const local = londonParts(real);
    return new Date(local + ":00Z");
  }
  // TZID'd or floating: university timetables are UK-local, treat as London wall clock
  void prop;
  return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi));
}

const DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const iso = (d: Date) => d.toISOString().slice(0, 16);

export function parseIcs(ics: string, nowLocal: Date): BusyBlock[] {
  const lines = unfold(ics);
  const out: BusyBlock[] = [];
  const windowEnd = new Date(nowLocal.getTime() + WINDOW_DAYS * 86400000);
  const windowStart = new Date(nowLocal.getTime() - 86400000);
  let ev: Record<string, string> | null = null;
  const exdates: string[] = [];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { ev = {}; exdates.length = 0; continue; }
    if (line === "END:VEVENT" && ev) {
      const sKey = Object.keys(ev).find((k) => k.startsWith("DTSTART"));
      const eKey = Object.keys(ev).find((k) => k.startsWith("DTEND"));
      const start = sKey ? parseIcsDate(sKey, ev[sKey]!) : null;
      const end = eKey ? parseIcsDate(eKey, ev[eKey]!) : start && new Date(start.getTime() + 3600000);
      if (start && end && !/TRANSP:TRANSPARENT/.test(ev["TRANSP"] ?? "") && ev["STATUS"] !== "CANCELLED") {
        const dur = end.getTime() - start.getTime();
        const title = (ev["SUMMARY"] ?? "Class").replace(/\\,/g, ",").replace(/\\n/g, " ");
        const push = (s: Date) => {
          if (s >= windowStart && s <= windowEnd && !exdates.includes(iso(s)))
            out.push({ title, start: iso(s), end: iso(new Date(s.getTime() + dur)) });
        };
        const rrule = ev["RRULE"];
        if (!rrule) push(start);
        else {
          const r = Object.fromEntries(rrule.split(";").map((kv) => kv.split("=")));
          const interval = Number(r["INTERVAL"] ?? 1);
          const until = r["UNTIL"] ? parseIcsDate("UNTIL", r["UNTIL"]) : null;
          let count = r["COUNT"] ? Number(r["COUNT"]) : Infinity;
          const days = r["BYDAY"] ? (r["BYDAY"] as string).split(",").map((d) => DAY.indexOf(d.slice(-2))) : [start.getUTCDay()];
          const step = r["FREQ"] === "DAILY" ? 1 : 7;
          // Walk week by week (or day by day) from the series start
          for (let base = new Date(start); base <= windowEnd && count > 0; base = new Date(base.getTime() + step * interval * 86400000)) {
            if (until && base > until) break;
            const cands = step === 1 ? [base] : days.map((dw) => {
              const weekStart = new Date(base.getTime() - base.getUTCDay() * 86400000);
              return new Date(weekStart.getTime() + dw * 86400000);
            }).filter((d) => d >= start).sort((a, b) => +a - +b);
            for (const c of cands) {
              if (until && c > until) break;
              if (count-- <= 0) break;
              push(c);
            }
          }
        }
      }
      ev = null;
      continue;
    }
    if (ev) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (key.startsWith("EXDATE")) {
        val.split(",").forEach((v) => { const d = parseIcsDate(key, v); if (d) exdates.push(iso(d)); });
      } else ev[key.split(";")[0] === "DTSTART" || key.split(";")[0] === "DTEND" ? key : key.split(";")[0]!] = val;
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export const getTimetable = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ url: z.string().min(8).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const url = data.url.trim().replace(/^webcals?:\/\//i, "https://");
    if (!/^https:\/\//i.test(url)) throw new Error("Please paste an https or webcal calendar link");
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Couldn't read calendar (HTTP ${res.status})`);
    const text = await res.text();
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link isn't a calendar (.ics) feed");
    const nowLocal = new Date(londonParts(new Date()) + ":00Z");
    return { blocks: parseIcs(text, nowLocal) };
  });
