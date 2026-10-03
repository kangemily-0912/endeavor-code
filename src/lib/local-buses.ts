import type { Journey } from "./activities";

// Non-Ember buses from Dundee, kept as timetable patterns (no free live feed
// exists for these operators in Scotland). Times are approximate.
type Route = {
  operator: string;
  to: RegExp; // destination towns this route serves
  stop: string;
  firstMin: number; // first departure, minutes after midnight
  lastMin: number;
  everyMin: number;
  offsetMin: number; // minute past the hour pattern starts
  rideMin: number;
};

export const LOCAL_ROUTES: Route[] = [
  { operator: "Stagecoach 99", to: /st\.? andrews/i, stop: "Dundee Bus Station", firstMin: 360, lastMin: 1410, everyMin: 20, offsetMin: 5, rideMin: 37 },
  { operator: "Stagecoach 99C", to: /st\.? andrews/i, stop: "Dundee Bus Station", firstMin: 420, lastMin: 1320, everyMin: 30, offsetMin: 15, rideMin: 48 },
  { operator: "Stagecoach 99D", to: /st\.? andrews/i, stop: "Dundee Bus Station", firstMin: 420, lastMin: 1140, everyMin: 60, offsetMin: 35, rideMin: 42 },
  { operator: "Moffat & Williamson 92", to: /st\.? andrews/i, stop: "Dundee Bus Station", firstMin: 480, lastMin: 1080, everyMin: 60, offsetMin: 50, rideMin: 45 },
];

export function localBusOptions(
  town: string,
  nowMin: number,
  startMin: number,
  firstMileMin = 6,
  lastMileMin = 6,
): Journey[] {
  const out: Journey[] = [];
  for (const r of LOCAL_ROUTES) {
    if (!r.to.test(town)) continue;
    for (let d = r.firstMin; d <= r.lastMin; d += r.everyMin) {
      const dep = Math.floor(d / 60) * 60 + ((d % 60) + r.offsetMin) % 60;
      const leaveBy = dep - firstMileMin;
      const arrive = dep + r.rideMin + lastMileMin;
      if (leaveBy < nowMin || arrive > startMin) continue;
      out.push({
        operator: r.operator,
        leaveByMin: leaveBy,
        departMin: dep,
        arriveMin: arrive,
        totalMin: arrive - leaveBy,
        legs: [
          { mode: "walk", label: `Walk to ${r.stop}`, durationMin: firstMileMin },
          { mode: "bus", label: `${r.operator} → ${town}`, durationMin: r.rideMin },
          { mode: "walk", label: "Walk to the venue", durationMin: lastMileMin },
        ],
      });
    }
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
  return { ...best!, alternatives: alts.slice(0, 4) };
}
