import { ACTIVITIES, DEMO_NOW_MIN, type Activity } from "./activities";

export type ScoredActivity = {
  activity: Activity;
  interestMatch: number; // 0..1
  timeFit: number; // 0..1
  reachability: number; // 0..1
  availability: number; // 0..1
  score: number; // 0..100
  reachable: boolean;
  arriveByMin: number;
  matchedTags: string[];
};

const TAG_KEYWORDS: Record<string, string[]> = {
  dance: ["dance", "dancing", "salsa", "bachata", "ceilidh", "zumba", "boogie"],
  active: ["active", "sport", "exercise", "move", "energetic", "run", "running", "fitness"],
  fitness: ["fitness", "gym", "workout", "climb", "climbing", "bouldering"],
  outdoors: ["outdoor", "outdoors", "outside", "nature", "beach", "coast", "coastal", "fresh air", "hike", "walk"],
  creative: ["creative", "art", "draw", "drawing", "paint", "painting", "craft", "make", "making", "pottery"],
  music: ["music", "gig", "concert", "sing", "singing", "open mic", "band", "live"],
  social: ["social", "meet", "people", "friends", "community", "chat"],
  food: ["food", "eat", "eating", "coffee", "café", "cafe", "taste", "tasting", "forage", "foraging"],
  calm: ["calm", "relax", "relaxing", "chill", "quiet", "gentle", "slow"],
  adventure: ["adventure", "adventurous", "kayak", "kayaking", "water", "sea", "thrill"],
  games: ["game", "games", "board game", "puzzle"],
  night: ["tonight", "evening", "night"],
  "hands-on": ["hands-on", "hands on", "workshop", "taster", "learn", "class", "lesson", "session"],
};

export function parseIntent(query: string): string[] {
  const q = query.toLowerCase();
  const tags = new Set<string>();
  for (const [tag, words] of Object.entries(TAG_KEYWORDS)) {
    if (words.some((w) => q.includes(w))) tags.add(tag);
  }
  // Generic "something to do" queries get a broad tag spread
  if (tags.size === 0) {
    ["social", "creative", "active"].forEach((t) => tags.add(t));
  }
  return [...tags];
}

function interestScore(activity: Activity, wanted: string[]): { score: number; matched: string[] } {
  const matched = activity.tags.filter((t) => wanted.includes(t));
  if (matched.length === 0) return { score: 0.15, matched };
  const score = Math.min(1, 0.45 + 0.55 * (matched.length / Math.max(wanted.length, 1)) + 0.1 * (matched.length - 1));
  return { score: Math.min(1, score), matched };
}

function timeFitScore(activity: Activity, nowMin: number): number {
  const minsUntilStart = activity.startMin - nowMin;
  if (minsUntilStart < 0) return 0; // already started
  if (minsUntilStart <= 90) return 1;
  if (minsUntilStart <= 180) return 0.85;
  if (minsUntilStart <= 300) return 0.6;
  return 0.4;
}

function reachabilityScore(activity: Activity, nowMin: number): { score: number; reachable: boolean } {
  const leaveBy = activity.journey.leaveByMin;
  const arriveBy = leaveBy + activity.journey.totalMin;
  const canArrive = leaveBy >= nowMin && arriveBy <= activity.startMin;
  if (!canArrive) return { score: 0, reachable: false };
  const t = activity.journey.totalMin;
  let score: number;
  if (t <= 15) score = 1;
  else if (t <= 30) score = 0.9;
  else if (t <= 45) score = 0.75;
  else if (t <= 60) score = 0.55;
  else score = 0.35;
  // Buffer bonus: leaving soon is fine, but very tight margins reduce confidence
  const bufferMin = activity.startMin - arriveBy;
  if (bufferMin < 5) score *= 0.9;
  return { score, reachable: true };
}

function availabilityScore(activity: Activity): number {
  if (activity.spacesLeft <= 0) return 0;
  if (activity.spacesLeft <= 3) return 0.6; // nearly full — urgency but risk
  if (activity.spacesLeft <= 10) return 1;
  return 0.9;
}

export function recommend(query: string, nowMin: number = DEMO_NOW_MIN): ScoredActivity[] {
  const wanted = parseIntent(query);
  const results: ScoredActivity[] = ACTIVITIES.map((activity) => {
    const { score: interestMatch, matched } = interestScore(activity, wanted);
    const timeFit = timeFitScore(activity, nowMin);
    const { score: reachability, reachable } = reachabilityScore(activity, nowMin);
    const availability = availabilityScore(activity);
    // Recommendation Score = Interest Match × Time Fit × Reachability × Availability
    const raw = interestMatch * timeFit * reachability * availability;
    return {
      activity,
      interestMatch,
      timeFit,
      reachability,
      availability,
      reachable,
      score: Math.round(raw * 100),
      arriveByMin: activity.journey.leaveByMin + activity.journey.totalMin,
      matchedTags: matched,
    };
  });
  return results.sort((a, b) => b.score - a.score);
}

export function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
