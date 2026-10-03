import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Search, Ticket, Users } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Event Spark — Find your next thing" },
      {
        name: "description",
        content: "The story behind Event Spark and our mission to make university life easier to discover and enjoy.",
      },
      { property: "og:title", content: "About Event Spark — Find your next thing" },
      {
        property: "og:description",
        content: "Less planning, more living. Discover the story and mission behind Event Spark.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const steps = [
  {
    number: "01",
    title: "Discover your thing",
    body: "Discover what you want to do. It can be something random or something tailored to your interests. Use the search bar on the home page or explore the events already there.",
    icon: Search,
    colour: "bg-reach",
  },
  {
    number: "02",
    title: "Get the full picture",
    body: "Click an event to see how to get there, the time and location, who's going, the organiser and any price details. For walkable trips or events within your city, use a Google Maps link for directions.",
    icon: MapPin,
    colour: "bg-accent",
  },
  {
    number: "03",
    title: "Go a little further",
    body: "For bigger trips to other cities, Ember can show upcoming buses to help you reach your destination in time.",
    icon: CalendarDays,
    colour: "bg-primary",
  },
  {
    number: "04",
    title: "Secure your spot",
    body: "Make sure you're signed up as a user, then confirm your details to secure a spot. Check any Instagram links too, in case the organiser has additional sign-up requirements.",
    icon: Ticket,
    colour: "bg-social",
  },
];

function AccentText({ children }: { children: ReactNode }) {
  return <span className="font-serif font-normal italic">{children}</span>;
}

function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7 sm:px-8">
        <Link to="/" aria-label="Event Spark home">
          <BrandLogo className="h-14 sm:h-16" />
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold" aria-label="About navigation">
          <span className="hidden sm:inline">About</span>
          <Button asChild variant="outline" className="rounded-full bg-card px-5 shadow-none">
            <Link to="/"><ArrowLeft className="size-4" /> Back to explore</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">The story behind Event Spark ✳</p>
        <h1 className="mt-7 max-w-5xl text-6xl font-bold leading-[0.94] sm:text-7xl lg:text-8xl">
          Less planning.<br /><AccentText>More living.</AccentText>
        </h1>
        <p className="mt-10 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          University life is full of things worth doing. Finding them shouldn’t feel like a full-time job.
        </p>
      </section>

      <section className="border-y border-border bg-primary/35">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.45fr_0.8fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">01 / The problem</p>
            <h2 className="mt-7 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
              Finding things to do at university can be <AccentText>stressful.</AccentText>
            </h2>
            <div className="mt-8 max-w-2xl space-y-5 text-base leading-relaxed text-foreground/75">
              <p>During freshers, it feels like we know what we want to do, but those freshers apps have no use after two weeks. Finding events and nights out can be overwhelming. You have to check WhatsApp, Instagram, your email and maybe even Facebook (people still use Facebook!?).</p>
              <p>It’s overwhelming and a little confusing at times. Sometimes when we have free time we genuinely don’t know what to do. And even when we get to the stage of wanting to do something, it often takes time to plan it out properly.</p>
              <p className="font-bold text-foreground">But no worries, because Event Spark fixes that problem!</p>
            </div>
          </div>
          <div className="relative mx-auto flex size-64 items-center justify-center rounded-full bg-background sm:size-72" aria-hidden="true">
            <span className="absolute -left-3 top-7 text-4xl text-primary-ink">＊</span>
            <div className="flex size-44 rotate-[-7deg] items-center justify-center bg-card text-8xl shadow-lift">🤔</div>
            <span className="absolute -right-2 bottom-5 text-5xl text-destructive">✦</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
        <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">02 / The idea</p>
        <div className="mt-7 grid gap-9 border-b border-border pb-16 md:grid-cols-[0.8fr_1.2fr]">
          <h2 className="text-4xl font-bold leading-tight sm:text-5xl">What do <AccentText>we do?</AccentText></h2>
          <p className="text-base leading-relaxed text-foreground/75">Now you can find uni events, nights out, socials, sports events, academic events and many more events. You can personalise your search to your interests and even check what your friends are up to! These events are related to your university, but extend beyond it too. If you want to go bowling, Event Spark could cook up a time and date for you to go bowling in Dundee.</p>
        </div>
        <div className="grid gap-9 pt-16 md:grid-cols-[0.8fr_1.2fr]">
          <h2 className="text-4xl font-bold leading-tight sm:text-5xl">Our <AccentText>mission.</AccentText></h2>
          <p className="text-base leading-relaxed text-foreground/75">We want students to enjoy their time at university by reducing the stress involved in planning and booking activities. Through Event Spark, we want to build a welcoming community, ensuring everyone has things they can attend or enjoy by themselves or with others.</p>
        </div>
      </section>

      <section className="border-y border-border bg-accent/45">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
          <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">03 / Join the spark</p>
          <h2 className="mt-7 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">How do I get involved <AccentText>and how does it work?</AccentText></h2>
          <p className="mt-7 max-w-3xl text-base leading-relaxed text-foreground/75">You can sign up as a Sparker (Guest) or an Igniter (Host). As an Igniter, you can post your own events. As a Sparker, you can set your interests, import your personal calendar to ensure no calendar clashes, and see what your friends are going to do.</p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            <article className="border-t-2 border-foreground pt-6">
              <Users className="size-7" />
              <h3 className="mt-5 text-3xl font-bold">Sparker <AccentText>/ Guest</AccentText></h3>
              <p className="mt-3 max-w-md leading-relaxed text-foreground/70">Follow your interests, find a plan that fits and see what your friends are up to.</p>
            </article>
            <article className="border-t-2 border-destructive pt-6">
              <span className="text-3xl text-destructive" aria-hidden="true">＊</span>
              <h3 className="mt-3 text-3xl font-bold">Igniter <AccentText>/ Host</AccentText></h3>
              <p className="mt-3 max-w-md leading-relaxed text-foreground/70">Bring people together by posting events of your own.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
        <p className="font-mono text-xs font-semibold uppercase text-muted-foreground">04 / From idea to event</p>
        <h2 className="mt-7 text-4xl font-bold leading-tight sm:text-5xl">Here’s a step through <AccentText>booking an event.</AccentText></h2>
        <div className="mt-14 grid gap-x-10 sm:grid-cols-2">
          {steps.map(({ number, title, body, icon: Icon, colour }) => (
            <article key={number} className="border-t border-border py-7 sm:min-h-64">
              <div className="flex items-start justify-between">
                <span className={`flex size-12 items-center justify-center rounded-full ${colour}`}><Icon className="size-5" /></span>
                <span className="font-serif text-3xl italic text-muted-foreground">{number}</span>
              </div>
              <h3 className="mt-6 text-2xl font-bold sm:text-3xl">{title}</h3>
              <p className="mt-3 max-w-lg leading-relaxed text-foreground/70">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="font-serif text-3xl italic">Your next thing is out there.</p>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-background/60">Event Spark is currently an interactive visual prototype. Sign-up, calendars, event posting and booking are not available in this demo.</p>
          </div>
          <Button asChild className="self-start rounded-full px-6 sm:self-auto">
            <Link to="/">Explore events <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </footer>
    </main>
  );
}