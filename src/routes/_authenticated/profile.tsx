import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-auth";
import { CATEGORIES } from "@/lib/sorting";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Wayfare" },
      { name: "description", content: "Your Wayfare preferences, timetable and friends." },
      { property: "og:title", content: "Your profile — Wayfare" },
      { property: "og:description", content: "Manage preferences, timetable and friends on Wayfare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type Friend = { friendship_id: string; friend_id: string; display_name: string | null; handle: string | null; status: string; incoming: boolean };

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { profile, save } = useProfile(user.id);
  const [form, setForm] = useState({ display_name: "", home_town: "Dundee", fav: [] as string[], budget: "", travel: "", tt: "" });
  const [saved, setSaved] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [handle, setHandle] = useState("");
  const [fmsg, setFmsg] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? "", home_town: profile.home_town, fav: profile.fav_categories,
      budget: profile.max_budget?.toString() ?? "", travel: profile.max_travel_min?.toString() ?? "", tt: profile.timetable_url ?? "",
    });
  }, [profile]);

  const loadFriends = () => supabase.rpc("my_friends").then(({ data }) => setFriends((data as Friend[]) ?? []));
  useEffect(() => { loadFriends(); }, []);

  const submit = async () => {
    await save({
      display_name: form.display_name || null, home_town: form.home_town, fav_categories: form.fav,
      max_budget: form.budget ? Number(form.budget) : null, max_travel_min: form.travel ? Number(form.travel) : null,
      timetable_url: form.tt || null,
    });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const addFriend = async () => {
    setFmsg(null);
    const { data, error } = await supabase.rpc("add_friend_by_handle", { _handle: handle });
    if (error) return setFmsg(error.message);
    setFmsg({ not_found: "No one with that code.", self: "That's your own code.", sent: "Request sent!", accepted: "You're now friends!" }[data as string] ?? null);
    setHandle(""); loadFriends();
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };
  const input = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-ring";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to search</Link>
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground">Sign out</button>
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold">Your profile</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>

        <section className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display font-semibold">Preferences</h2>
          <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Display name</span>
            <input className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
          <div className="space-y-1.5"><span className="text-xs text-muted-foreground">Home town</span>
            <div className="flex gap-2">{["Dundee", "St Andrews"].map((t) => (
              <button key={t} onClick={() => setForm({ ...form, home_town: t })} className={cn("rounded-full border px-4 py-1.5 text-xs", form.home_town === t ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{t}</button>
            ))}</div></div>
          <div className="space-y-1.5"><span className="text-xs text-muted-foreground">Favourite categories</span>
            <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => {
              const on = form.fav.includes(c);
              return <button key={c} onClick={() => setForm({ ...form, fav: on ? form.fav.filter((x) => x !== c) : [...form.fav, c] })}
                className={cn("rounded-full border px-3 py-1 text-xs capitalize", on ? "border-accent bg-accent/40 text-accent-ink" : "border-border text-muted-foreground")}>{c}</button>;
            })}</div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Max budget (£)</span>
              <input type="number" min={0} className={input} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="No limit" /></label>
            <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Max travel time (min)</span>
              <input type="number" min={0} className={input} value={form.travel} onChange={(e) => setForm({ ...form, travel: e.target.value })} placeholder="No limit" /></label>
          </div>
          <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Outlook timetable link (ICS)</span>
            <input className={input} value={form.tt} onChange={(e) => setForm({ ...form, tt: e.target.value })} placeholder="https://outlook.office365.com/…/calendar.ics" /></label>
          <button onClick={submit} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
            {saved ? <><Check className="size-4" /> Saved</> : "Save preferences"}
          </button>
        </section>

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-semibold">Friends</h2>
            <span className="font-mono text-xs text-muted-foreground">Your code: <span className="text-social-ink font-bold">{profile?.handle ?? "…"}</span></span>
          </div>
          <div className="flex gap-2">
            <input className={input} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Friend's code" />
            <button onClick={addFriend} disabled={!handle} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><UserPlus className="size-4" /> Add</button>
          </div>
          {fmsg && <p className="text-xs text-social-ink">{fmsg}</p>}
          {friends.length === 0 ? <p className="text-xs text-muted-foreground">Share your code with friends so you can see what they're going to.</p> : (
            <ul className="space-y-2">{friends.map((f) => (
              <li key={f.friendship_id} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                <span className="font-semibold">{f.display_name ?? f.handle}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{f.status === "accepted" ? "friend" : f.incoming ? "wants to be friends" : "request sent"}</span>
                <span className="ml-auto flex gap-1">
                  {f.status === "pending" && f.incoming && (
                    <button onClick={async () => { await supabase.from("friendships").update({ status: "accepted" }).eq("id", f.friendship_id); loadFriends(); }} className="rounded-md bg-primary p-1 text-primary-foreground"><Check className="size-3.5" /></button>
                  )}
                  <button onClick={async () => { await supabase.from("friendships").delete().eq("id", f.friendship_id); loadFriends(); }} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
                </span>
              </li>
            ))}</ul>
          )}
        </section>
        {!profile && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
