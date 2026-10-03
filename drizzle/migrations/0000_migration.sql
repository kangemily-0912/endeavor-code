CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  handle text UNIQUE,
  home_town text NOT NULL DEFAULT 'Dundee',
  fav_categories text[] NOT NULL DEFAULT '{}',
  max_budget numeric,
  max_travel_min integer,
  timetable_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, handle)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    lower(substr(md5(NEW.id::text),1,6)))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester uuid NOT NULL,
  addressee uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester, addressee)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own friendships" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() IN (requester, addressee));
CREATE POLICY "send request" ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester AND status = 'pending');
CREATE POLICY "accept request" ON public.friendships FOR UPDATE TO authenticated USING (auth.uid() = addressee) WITH CHECK (status IN ('pending','accepted'));
CREATE POLICY "remove friendship" ON public.friendships FOR DELETE TO authenticated USING (auth.uid() IN (requester, addressee));

CREATE TABLE public.attendance (
  user_id uuid NOT NULL,
  activity_id text NOT NULL,
  activity_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)
);
GRANT SELECT, INSERT, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attendance read" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own attendance add" ON public.attendance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own attendance remove" ON public.attendance FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public counts only (no identities)
CREATE OR REPLACE FUNCTION public.going_counts(_ids text[]) RETURNS TABLE(activity_id text, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.activity_id, count(*) FROM public.attendance a WHERE a.activity_id = ANY(_ids) GROUP BY a.activity_id
$$;
GRANT EXECUTE ON FUNCTION public.going_counts(text[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_friends() RETURNS TABLE(friendship_id uuid, friend_id uuid, display_name text, handle text, status text, incoming boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, CASE WHEN f.requester = auth.uid() THEN f.addressee ELSE f.requester END,
    p.display_name, p.handle, f.status, f.addressee = auth.uid()
  FROM public.friendships f
  JOIN public.profiles p ON p.id = CASE WHEN f.requester = auth.uid() THEN f.addressee ELSE f.requester END
  WHERE auth.uid() IN (f.requester, f.addressee)
$$;
GRANT EXECUTE ON FUNCTION public.my_friends() TO authenticated;

CREATE OR REPLACE FUNCTION public.add_friend_by_handle(_handle text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT id INTO target FROM public.profiles WHERE handle = lower(trim(_handle));
  IF target IS NULL THEN RETURN 'not_found'; END IF;
  IF target = auth.uid() THEN RETURN 'self'; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE requester = target AND addressee = auth.uid()) THEN
    UPDATE public.friendships SET status = 'accepted' WHERE requester = target AND addressee = auth.uid();
    RETURN 'accepted';
  END IF;
  INSERT INTO public.friendships (requester, addressee) VALUES (auth.uid(), target) ON CONFLICT DO NOTHING;
  RETURN 'sent';
END $$;
GRANT EXECUTE ON FUNCTION public.add_friend_by_handle(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.friends_going(_ids text[]) RETURNS TABLE(activity_id text, names text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.activity_id, array_agg(p.display_name)
  FROM public.attendance a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.activity_id = ANY(_ids) AND a.user_id IN (
    SELECT CASE WHEN requester = auth.uid() THEN addressee ELSE requester END
    FROM public.friendships WHERE status = 'accepted' AND auth.uid() IN (requester, addressee))
  GROUP BY a.activity_id
$$;
GRANT EXECUTE ON FUNCTION public.friends_going(text[]) TO authenticated;