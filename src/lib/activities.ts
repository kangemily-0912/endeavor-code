export type JourneyLeg = {
  mode: "walk" | "bus" | "train";
  label: string;
  durationMin: number;
};

export type Journey = {
  leaveByMin: number; // must leave by (minutes after midnight, local)
  totalMin: number;
  legs: JourneyLeg[];
  live?: boolean; // true when built from the live Ember API
  pricePence?: number; // live fare, when known
  seatsLeft?: number; // live seat availability, when known
};

export type Activity = {
  id: string;
  title: string;
  venue: string;
  town: string;
  source: string; // where the listing was aggregated from
  tags: string[]; // interest tags
  startOffsetMin: number; // starts this many minutes after "now"
  durationMin: number;
  priceGbp: number;
  spacesLeft: number;
  description: string;
  // Local activities: simple walk. Remote: resolved live via the Ember API.
  walkMin?: number;
  ember?: { destQuery: string; lastMileMin: number; firstMileMin: number };
  // Fallback journey used if the live API is unreachable
  fallbackJourney?: { leaveOffsetMin: number; totalMin: number; legs: JourneyLeg[] };
};

// Demo scenario: user is in Dundee (Ember's home network). "Now" is the real
// current time, so live Ember quotes always line up with the demo clock.
export const DEMO_LOCATION = "Dundee";
export const EMBER_ORIGIN_ID = 13; // Dundee (City Centre)

export const ACTIVITIES: Activity[] = [
  {
    id: "salsa-edinburgh",
    title: "Beginner Salsa Session",
    venue: "Dance Base Studio",
    town: "Edinburgh",
    source: "Instagram · @dancebase_edi",
    tags: ["dance", "active", "social", "creative"],
    startOffsetMin: 100,
    durationMin: 90,
    priceGbp: 8,
    spacesLeft: 6,
    description:
      "A friendly drop-in salsa class for complete beginners. No partner needed — posted this morning on the studio's Instagram.",
    ember: { destQuery: "Edinburgh City Centre", lastMileMin: 9, firstMileMin: 8 },
  },
  {
    id: "bachata-dundee",
    title: "Bachata Social Night",
    venue: "The Reading Rooms",
    town: "Dundee",
    source: "Community page · Dundee Latin Dance",
    tags: ["dance", "social", "night", "music"],
    startOffsetMin: 330,
    durationMin: 180,
    priceGbp: 5,
    spacesLeft: 40,
    description:
      "Weekly social run by the local Latin dance community. Beginner taster first, then open floor.",
    walkMin: 12,
  },
  {
    id: "street-food-edinburgh",
    title: "Street Food Market",
    venue: "The Pitt Market",
    town: "Edinburgh",
    source: "Eventbrite",
    tags: ["food", "social", "outdoors", "night"],
    startOffsetMin: 240,
    durationMin: 240,
    priceGbp: 0,
    spacesLeft: 200,
    description:
      "Weekend street food market with local vendors, live music and communal tables. Free entry.",
    ember: { destQuery: "Edinburgh City Centre", lastMileMin: 14, firstMileMin: 8 },
  },
  {
    id: "pottery-dundee",
    title: "Pottery Taster: Throw a Mug",
    venue: "Clayworks Studio",
    town: "Dundee",
    source: "Eventbrite",
    tags: ["creative", "craft", "hands-on", "indoors"],
    startOffsetMin: 60,
    durationMin: 120,
    priceGbp: 22,
    spacesLeft: 3,
    description:
      "Two-hour wheel-throwing taster. You keep one glazed mug, posted back to you after firing.",
    walkMin: 15,
  },
  {
    id: "indie-gig-glasgow",
    title: "Live Indie Gig: The Cairds",
    venue: "King Tut's Wah Wah Hut",
    town: "Glasgow",
    source: "Instagram · @kingtuts",
    tags: ["music", "night", "social", "live"],
    startOffsetMin: 360,
    durationMin: 180,
    priceGbp: 14,
    spacesLeft: 30,
    description:
      "Up-and-coming Scottish indie band, support from two local acts. Over-18s, standing.",
    ember: { destQuery: "Glasgow", lastMileMin: 10, firstMileMin: 8 },
  },
  {
    id: "life-drawing",
    title: "Drop-in Life Drawing",
    venue: "Dundee Contemporary Arts, Studio 3",
    town: "Dundee",
    source: "University Society · Art Society",
    tags: ["creative", "art", "indoors", "calm"],
    startOffsetMin: 150,
    durationMin: 120,
    priceGbp: 4,
    spacesLeft: 12,
    description:
      "Untutored life drawing session. Materials provided, all levels. Run by the Art Society.",
    walkMin: 10,
  },
  {
    id: "open-mic",
    title: "Open Mic Night",
    venue: "Clarks on Lindsay Street",
    town: "Dundee",
    source: "Instagram Story · @clarksdundee",
    tags: ["music", "night", "social", "creative"],
    startOffsetMin: 420,
    durationMin: 150,
    priceGbp: 0,
    spacesLeft: 60,
    description:
      "Announced via an Instagram Story this afternoon. Sign up early, music from doors.",
    walkMin: 9,
  },
  {
    id: "riverside-perth",
    title: "Riverside Parkrun & Coffee",
    venue: "North Inch Park",
    town: "Perth",
    source: "Community page · Perth Runners",
    tags: ["active", "outdoors", "fitness", "social"],
    startOffsetMin: 120,
    durationMin: 90,
    priceGbp: 0,
    spacesLeft: 80,
    description:
      "Social 5k along the Tay, all paces welcome, followed by coffee at the park café.",
    ember: { destQuery: "Perth", lastMileMin: 12, firstMileMin: 8 },
  },
  {
    id: "board-games",
    title: "Board Games Café Afternoon",
    venue: "Blend Coffee Lounge",
    town: "Dundee",
    source: "Café noticeboard · submitted directly",
    tags: ["social", "indoors", "calm", "games", "food"],
    startOffsetMin: 30,
    durationMin: 180,
    priceGbp: 3,
    spacesLeft: 18,
    description:
      "Open tables with a library of 200+ games. Staff help you pick and teach the rules.",
    walkMin: 6,
  },
  {
    id: "climbing-dundee",
    title: "Bouldering Intro Session",
    venue: "Avertical World",
    town: "Dundee",
    source: "Eventbrite",
    tags: ["active", "fitness", "indoors", "adventure"],
    startOffsetMin: 180,
    durationMin: 90,
    priceGbp: 14,
    spacesLeft: 8,
    description:
      "Supervised intro to bouldering with shoe hire included. Great first-timer session.",
    walkMin: 18,
  },
  {
    id: "whisky-edinburgh",
    title: "Whisky Tasting: Highland vs Island",
    venue: "The Scotch Malt Bar",
    town: "Edinburgh",
    source: "Eventbrite",
    tags: ["food", "night", "social", "indoors"],
    startOffsetMin: 400,
    durationMin: 120,
    priceGbp: 28,
    spacesLeft: 10,
    description:
      "Guided tasting of five single malts with a resident whisky expert. Over-18s only.",
    ember: { destQuery: "Edinburgh City Centre", lastMileMin: 7, firstMileMin: 8 },
  },
  {
    id: "foraging-st-andrews",
    title: "Coastal Foraging Walk",
    venue: "West Sands Beach",
    town: "St Andrews",
    source: "Independent business · Fife Wild Food",
    tags: ["outdoors", "food", "nature", "calm"],
    startOffsetMin: 90,
    durationMin: 120,
    priceGbp: 18,
    spacesLeft: 10,
    description:
      "Learn to identify edible seaweeds and coastal plants with a local forager. Ends with a tasting.",
    fallbackJourney: {
      leaveOffsetMin: 45,
      totalMin: 40,
      legs: [
        { mode: "walk", label: "Walk to Dundee Bus Station", durationMin: 8 },
        { mode: "bus", label: "Stagecoach 99 → St Andrews", durationMin: 27 },
        { mode: "walk", label: "Walk to West Sands", durationMin: 5 },
      ],
    },
  },
];
