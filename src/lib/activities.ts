export type JourneyLeg = {
  mode: "walk" | "bus" | "train";
  label: string;
  durationMin: number;
};

export type Activity = {
  id: string;
  title: string;
  venue: string;
  town: string;
  source: string; // where the listing was aggregated from
  tags: string[]; // interest tags
  startMin: number; // minutes after midnight
  endMin: number;
  priceGbp: number;
  spacesLeft: number;
  description: string;
  journey: {
    leaveByMin: number; // must leave by (minutes after midnight)
    totalMin: number;
    legs: JourneyLeg[];
  };
};

// Demo scenario: Saturday, user is in St Andrews, "now" is 14:00.
export const DEMO_NOW_MIN = 14 * 60;
export const DEMO_LOCATION = "St Andrews";

export const ACTIVITIES: Activity[] = [
  {
    id: "salsa-dundee",
    title: "Beginner Salsa Session",
    venue: "Dance Base Studio",
    town: "Dundee",
    source: "Instagram · @dancebase_dundee",
    tags: ["dance", "active", "social", "creative"],
    startMin: 15 * 60 + 30,
    endMin: 17 * 60,
    priceGbp: 8,
    spacesLeft: 6,
    description:
      "A friendly drop-in salsa class for complete beginners. No partner needed — posted this morning on the studio's Instagram.",
    journey: {
      leaveByMin: 14 * 60 + 35,
      totalMin: 48,
      legs: [
        { mode: "walk", label: "Walk to St Andrews Bus Station", durationMin: 8 },
        { mode: "bus", label: "Ember E1 → Dundee City Centre", durationMin: 33 },
        { mode: "walk", label: "Walk to Dance Base Studio", durationMin: 7 },
      ],
    },
  },
  {
    id: "bachata-st-andrews",
    title: "Bachata Social Night",
    venue: "Students' Union, Club 601",
    town: "St Andrews",
    source: "University Society · Salsa Society",
    tags: ["dance", "social", "night", "music"],
    startMin: 20 * 60,
    endMin: 23 * 60,
    priceGbp: 5,
    spacesLeft: 40,
    description:
      "Weekly social run by the university Salsa Society. Beginner taster at 8pm, then open floor.",
    journey: {
      leaveByMin: 19 * 60 + 40,
      totalMin: 12,
      legs: [{ mode: "walk", label: "Walk to the Students' Union", durationMin: 12 }],
    },
  },
  {
    id: "zumba-cupar",
    title: "Zumba in the Park",
    venue: "Haugh Park",
    town: "Cupar",
    source: "Community page · Cupar Events",
    tags: ["dance", "active", "outdoors", "fitness"],
    startMin: 16 * 60,
    endMin: 17 * 60,
    priceGbp: 0,
    spacesLeft: 25,
    description:
      "Free outdoor Zumba session organised by the local community council. Bring water and trainers.",
    journey: {
      leaveByMin: 15 * 60 + 10,
      totalMin: 42,
      legs: [
        { mode: "walk", label: "Walk to Bus Station", durationMin: 8 },
        { mode: "bus", label: "Stagecoach 99 → Cupar", durationMin: 29 },
        { mode: "walk", label: "Walk to Haugh Park", durationMin: 5 },
      ],
    },
  },
  {
    id: "coastal-run",
    title: "Fife Coastal Path Group Run",
    venue: "East Sands Beach",
    town: "St Andrews",
    source: "Instagram · @standrewsrunclub",
    tags: ["active", "outdoors", "fitness", "social"],
    startMin: 15 * 60,
    endMin: 16 * 60 + 30,
    priceGbp: 0,
    spacesLeft: 15,
    description:
      "Weekly social run along the coastal path. All paces welcome, ~8km out and back. Meet point posted on Instagram.",
    journey: {
      leaveByMin: 14 * 60 + 45,
      totalMin: 15,
      legs: [{ mode: "walk", label: "Walk to East Sands", durationMin: 15 }],
    },
  },
  {
    id: "pottery-dundee",
    title: "Pottery Taster: Throw a Mug",
    venue: "Clayworks Studio",
    town: "Dundee",
    source: "Eventbrite",
    tags: ["creative", "craft", "hands-on", "indoors"],
    startMin: 15 * 60,
    endMin: 17 * 60,
    priceGbp: 22,
    spacesLeft: 3,
    description:
      "Two-hour wheel-throwing taster. You keep one glazed mug, posted back to you after firing.",
    journey: {
      leaveByMin: 14 * 60 + 5,
      totalMin: 50,
      legs: [
        { mode: "walk", label: "Walk to St Andrews Bus Station", durationMin: 8 },
        { mode: "bus", label: "Ember E1 → Dundee", durationMin: 33 },
        { mode: "walk", label: "Walk to Clayworks Studio", durationMin: 9 },
      ],
    },
  },
  {
    id: "life-drawing",
    title: "Drop-in Life Drawing",
    venue: "Townshend Building, Studio 3",
    town: "St Andrews",
    source: "University Society · Art Society",
    tags: ["creative", "art", "indoors", "calm"],
    startMin: 16 * 60 + 30,
    endMin: 18 * 60 + 30,
    priceGbp: 4,
    spacesLeft: 12,
    description:
      "Untutored life drawing session. Materials provided, all levels. Run by the Art Society.",
    journey: {
      leaveByMin: 16 * 60 + 15,
      totalMin: 10,
      legs: [{ mode: "walk", label: "Walk to Townshend Building", durationMin: 10 }],
    },
  },
  {
    id: "open-mic",
    title: "Open Mic Night",
    venue: "The Rule Bar",
    town: "St Andrews",
    source: "Instagram Story · @therulestandrews",
    tags: ["music", "night", "social", "creative"],
    startMin: 21 * 60,
    endMin: 23 * 60 + 30,
    priceGbp: 0,
    spacesLeft: 60,
    description:
      "Announced via an Instagram Story this afternoon. Sign up from 8:30pm, music from 9pm.",
    journey: {
      leaveByMin: 20 * 60 + 45,
      totalMin: 9,
      legs: [{ mode: "walk", label: "Walk to The Rule", durationMin: 9 }],
    },
  },
  {
    id: "ceilidh-anstruther",
    title: "Community Ceilidh",
    venue: "Dreel Halls",
    town: "Anstruther",
    source: "Community page · East Neuk Events",
    tags: ["dance", "music", "social", "night", "scottish"],
    startMin: 19 * 60 + 30,
    endMin: 22 * 60 + 30,
    priceGbp: 10,
    spacesLeft: 45,
    description:
      "Traditional Scottish ceilidh with a live band. Callers talk you through every dance.",
    journey: {
      leaveByMin: 18 * 60 + 35,
      totalMin: 44,
      legs: [
        { mode: "walk", label: "Walk to Bus Station", durationMin: 8 },
        { mode: "bus", label: "Stagecoach 95 → Anstruther", durationMin: 31 },
        { mode: "walk", label: "Walk to Dreel Halls", durationMin: 5 },
      ],
    },
  },
  {
    id: "kayak",
    title: "Sea Kayak Taster",
    venue: "Isle of May Boatshed",
    town: "Anstruther",
    source: "Independent business · East Neuk Outdoors",
    tags: ["outdoors", "active", "adventure", "water"],
    startMin: 14 * 60 + 30,
    endMin: 16 * 60 + 30,
    priceGbp: 35,
    spacesLeft: 2,
    description:
      "Guided two-hour paddle along the East Neuk coastline. All kit provided, no experience needed.",
    journey: {
      leaveByMin: 13 * 60 + 40,
      totalMin: 44,
      legs: [
        { mode: "walk", label: "Walk to Bus Station", durationMin: 8 },
        { mode: "bus", label: "Stagecoach 95 → Anstruther", durationMin: 31 },
        { mode: "walk", label: "Walk to the Boatshed", durationMin: 5 },
      ],
    },
  },
  {
    id: "board-games",
    title: "Board Games Café Afternoon",
    venue: "Moka Coffee House",
    town: "St Andrews",
    source: "Café noticeboard · submitted directly",
    tags: ["social", "indoors", "calm", "games", "food"],
    startMin: 14 * 60 + 30,
    endMin: 17 * 60 + 30,
    priceGbp: 3,
    spacesLeft: 18,
    description:
      "Open tables with a library of 200+ games. Staff help you pick and teach the rules.",
    journey: {
      leaveByMin: 14 * 60 + 20,
      totalMin: 6,
      legs: [{ mode: "walk", label: "Walk to Moka Coffee House", durationMin: 6 }],
    },
  },
  {
    id: "climbing-dundee",
    title: "Bouldering Intro Session",
    venue: "Avertical World",
    town: "Dundee",
    source: "Eventbrite",
    tags: ["active", "fitness", "indoors", "adventure"],
    startMin: 17 * 60,
    endMin: 18 * 60 + 30,
    priceGbp: 14,
    spacesLeft: 8,
    description:
      "Supervised intro to bouldering with shoe hire included. Great first-timer session.",
    journey: {
      leaveByMin: 16 * 60 + 5,
      totalMin: 47,
      legs: [
        { mode: "walk", label: "Walk to St Andrews Bus Station", durationMin: 8 },
        { mode: "bus", label: "Ember E1 → Dundee", durationMin: 33 },
        { mode: "walk", label: "Walk to Avertical World", durationMin: 6 },
      ],
    },
  },
  {
    id: "foraging",
    title: "Coastal Foraging Walk",
    venue: "Kingsbarns Beach",
    town: "Kingsbarns",
    source: "Independent business · Fife Wild Food",
    tags: ["outdoors", "food", "nature", "calm"],
    startMin: 15 * 60 + 30,
    endMin: 17 * 60 + 30,
    priceGbp: 18,
    spacesLeft: 10,
    description:
      "Learn to identify edible seaweeds and coastal plants with a local forager. Ends with a tasting.",
    journey: {
      leaveByMin: 14 * 60 + 55,
      totalMin: 30,
      legs: [
        { mode: "walk", label: "Walk to Bus Station", durationMin: 8 },
        { mode: "bus", label: "Stagecoach 95 → Kingsbarns", durationMin: 17 },
        { mode: "walk", label: "Walk to the beach", durationMin: 5 },
      ],
    },
  },
];
