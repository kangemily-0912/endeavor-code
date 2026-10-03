import type { Journey } from "./activities";
import data from "./bus-timetable.json";

// Every bus that serves St Andrews, from the official Bus Open Data (Traveline)
// GTFS timetable for Scotland. Regenerate bus-timetable.json to refresh.
type Stop = [string, string, number, number]; // area (S=St Andrews, D=Dundee), name, lat, lon
type Trip = [number, string, string, [number, number][]]; // route, service, headsign, [stop, min]
const TT = data as unknown as {
  base: string;
  stops: Stop[];
  routes: [string, string][];
  services: Record<string, string>;
  trips: Trip[];
};

function dayIndex(date = new Date()): number {
  const base = new Date(TT.base + "T00:00:00");
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((d.getTime() - base.getTime()) / 86400000);
}

function runsToday(service: string): boolean {
  const i = dayIndex();
  const bits = TT.services[service];
  return !!bits && i >= 0 && i < bits.length && bits[i] === "1";
}

export const LOCAL_ROUTE_NAMES = Array.from(new Set(TT.routes.map(([n, a]) => `${a} ${n}`)));

export function localBusOptions(
  town: string,
  nowMin: number,
  startMin: number,
  firstMileMin = 6,
  lastMileMin = 6,
): Journey[] {
  if (!/st\.? andrews/i.test(town)) return [];
  const out: Journey[] = [];
  for (const [ri, svc, headsign, calls] of TT.trips) {
    if (!runsToday(svc)) continue;
    const from = calls.findIndex(([s]) => TT.stops[s]![0] === "D");
    if (from < 0) continue;
    const later = calls.slice(from + 1).filter(([s]) => TT.stops[s]![0] === "S");
    if (!later.length) continue;
    const to = later.find(([s]) => /bus station/i.test(TT.stops[s]![1])) ?? later[later.length - 1]!;
    const [fs, dep] = calls[from]!;
    const [ts, arrBus] = to;
    const [name, agency] = TT.routes[ri]!;
    const operator = `${agency.replace(" East Scotland", "")} ${name}`;
    const leaveBy = dep - firstMileMin;
    const arrive = arrBus + lastMileMin;
    if (leaveBy < nowMin || arrive > startMin) continue;
    out.push({
      operator,
      leaveByMin: leaveBy,
      departMin: dep,
      arriveMin: arrive,
      totalMin: arrive - leaveBy,
      legs: [
        { mode: "walk", label: `Walk to ${TT.stops[fs]![1]}`, durationMin: firstMileMin },
        { mode: "bus", label: `${operator} towards ${headsign} → ${TT.stops[ts]![1]}`, durationMin: arrBus - dep },
        { mode: "walk", label: "Walk to the venue", durationMin: lastMileMin },
      ],
    });
  }
  return out;
}

// Merge options from every operator: primary = earliest arrival.
export function combineOptions(options: Journey[]): Journey | null {
  if (!options.length) return null;
  const sorted = [...options].sort(
    (a, b) => (a.arriveMin ?? 0) - (b.arriveMin ?? 0) || a.leaveByMin - b.leaveByMin,
  );
  const [best, ...rest] = sorted;
  const seen = new Set<string>([best!.operator + "@" + best!.departMin]);
  const alts = rest.filter((j) => {
    const k = j.operator + "@" + j.departMin;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ...best!, alternatives: alts.slice(0, 6) };
}
