import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Wayfare" },
      { name: "description", content: "Sign in to Wayfare to save your timetable, preferences and see what friends are going to." },
      { property: "og:title", content: "Sign in — Wayfare" },
      { property: "og:description", content: "Save your timetable and preferences, and see where your friends are going." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (user) navigate({ to: "/", replace: true }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    }
    setBusy(false);
  };

  const oauth = async (provider: "microsoft" | "google") => {
    setMsg(null);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) setMsg(r.error.message ?? `${provider} sign-in failed`);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-6">
      <div className="route-grid pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lift">
        <Link to="/" className="mb-6 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <MapPin className="size-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">Wayfare</span>
        </Link>
        <h1 className="font-display text-2xl font-bold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Save your timetable, preferences and friends.</p>

        <button onClick={() => oauth("microsoft")} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary font-semibold hover:border-primary">
          <svg viewBox="0 0 21 21" className="size-4" aria-hidden><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
          Continue with Microsoft
        </button>
        <button onClick={() => oauth("google")} className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary font-semibold hover:border-primary">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2.1 3.7-5.1 3.7-8.6z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.8 3.6-4.9 6.8-4.9z"/></svg>
          Continue with Google
        </button>
        <div className="my-5 flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-ring" />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-ring" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-ring" />
          <button disabled={busy} className="flex h-11 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : mode === "in" ? "Sign in" : "Sign up"}
          </button>
        </form>
        {msg && <p className="mt-3 text-xs text-accent-ink">{msg}</p>}
        <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === "in" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
