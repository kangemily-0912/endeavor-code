import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    supabase.auth.getUser().then(({ data }) => { setUser(data.user ?? null); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle().then(({ data }) => setProfile(data));
  }, [userId]);
  const save = async (patch: Partial<Profile>) => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", userId).select().maybeSingle();
    if (data) setProfile(data);
  };
  return { profile, save };
}
