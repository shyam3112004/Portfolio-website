-- ==========================================================================
-- SUPABASE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Portfolio Website with Google OAuth & Strict Admin Protection
-- Authorized Admin: 3112004shyam@gmail.com
-- ==========================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Mirrors Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to auto-create profile on Supabase auth.users sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    CASE WHEN LOWER(new.email) = '3112004shyam@gmail.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    role = CASE WHEN LOWER(EXCLUDED.email) = '3112004shyam@gmail.com' THEN 'admin' ELSE public.profiles.role END,
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT false,
  year TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  live_url TEXT,
  github_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Projects are viewable by everyone" ON public.projects;
CREATE POLICY "Projects are viewable by everyone"
  ON public.projects FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only 3112004shyam@gmail.com can manage projects" ON public.projects;
CREATE POLICY "Only 3112004shyam@gmail.com can manage projects"
  ON public.projects FOR ALL
  USING (LOWER(auth.jwt() ->> 'email') = '3112004shyam@gmail.com')
  WITH CHECK (LOWER(auth.jwt() ->> 'email') = '3112004shyam@gmail.com');

-- 4. Skills Table
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Skills are viewable by everyone" ON public.skills;
CREATE POLICY "Skills are viewable by everyone"
  ON public.skills FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only 3112004shyam@gmail.com can manage skills" ON public.skills;
CREATE POLICY "Only 3112004shyam@gmail.com can manage skills"
  ON public.skills FOR ALL
  USING (LOWER(auth.jwt() ->> 'email') = '3112004shyam@gmail.com')
  WITH CHECK (LOWER(auth.jwt() ->> 'email') = '3112004shyam@gmail.com');

-- 5. Contact Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT DEFAULT 'other',
  body TEXT NOT NULL,
  consent BOOLEAN DEFAULT true,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit contact inquiry" ON public.messages;
CREATE POLICY "Anyone can submit contact inquiry"
  ON public.messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only 3112004shyam@gmail.com can view inquiries" ON public.messages;
CREATE POLICY "Only 3112004shyam@gmail.com can view inquiries"
  ON public.messages FOR SELECT
  USING (LOWER(auth.jwt() ->> 'email') = '3112004shyam@gmail.com');

-- 6. Analytics Events Table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_name TEXT NOT NULL,
  page_slug TEXT DEFAULT 'home',
  device TEXT,
  props JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only admin can view analytics" ON public.analytics_events;
CREATE POLICY "Only admin can view analytics"
  ON public.analytics_events FOR SELECT
  USING (LOWER(auth.jwt() ->> 'email') = '3112004shyam@gmail.com');
