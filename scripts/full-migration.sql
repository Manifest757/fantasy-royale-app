-- Fantasy Royale - FULL Database Migration (Clean Install)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Designed for a CLEAN database - run this ONCE after resetting.
-- Order matters: base tables first, then gamification tables, then RLS, then seed data.

-- ========================================
-- PART 1: BASE TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS contests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  sponsor TEXT NOT NULL DEFAULT 'Fantasy Royale',
  sponsor_logo TEXT,
  league TEXT NOT NULL,
  prize_pool TEXT NOT NULL,
  entries INTEGER DEFAULT 0,
  max_entries INTEGER NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  crowns INTEGER DEFAULT 0,
  is_premier BOOLEAN DEFAULT false,
  background_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2),
  image TEXT NOT NULL,
  rating NUMERIC(2,1) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  badge TEXT,
  category TEXT NOT NULL,
  sizes TEXT[],
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'Fantasy Royale',
  headline TEXT NOT NULL,
  thumbnail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  caption TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  category TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  is_live BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promo_slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'gradient',
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  sponsor TEXT NOT NULL DEFAULT 'Fantasy Royale',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticker_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  crowns INTEGER DEFAULT 2450,
  member_since TIMESTAMPTZ DEFAULT now(),
  contests_entered INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  owned_avatar_parts TEXT[] DEFAULT '{}',
  owned_room_items TEXT[] DEFAULT '{}',
  avatar_config JSONB DEFAULT '{}',
  placed_items JSONB DEFAULT '[]',
  contests_entered_ids TEXT[] DEFAULT '{}',
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_contests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  picks TEXT[] DEFAULT '{}',
  crowns_earned INTEGER DEFAULT 0,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS avatar_parts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common',
  unlock_type TEXT NOT NULL DEFAULT 'free',
  unlock_value INTEGER,
  unlock_contest_id TEXT,
  unlock_achievement_id TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common',
  unlock_type TEXT NOT NULL DEFAULT 'free',
  unlock_value INTEGER,
  unlock_contest_id TEXT,
  unlock_achievement_id TEXT,
  url TEXT,
  width INTEGER DEFAULT 1,
  depth INTEGER DEFAULT 1,
  z_height INTEGER DEFAULT 1,
  placement_surface TEXT NOT NULL DEFAULT 'floor',
  is_stackable BOOLEAN DEFAULT false,
  wall_side TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL,
  reward INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- PART 2: GAMIFICATION TABLES
-- ========================================

CREATE TABLE IF NOT EXISTS sports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id UUID REFERENCES sports(id),
  name TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID REFERENCES contests(id),
  user_id UUID REFERENCES auth.users(id),
  pick_json JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pick_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pick_id UUID REFERENCES picks(id),
  is_correct BOOLEAN NOT NULL,
  graded_at TIMESTAMPTZ DEFAULT now(),
  grade_details_json JSONB
);

CREATE TABLE IF NOT EXISTS contest_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID REFERENCES contests(id),
  user_id UUID REFERENCES auth.users(id),
  score_numeric NUMERIC NOT NULL DEFAULT 0,
  rank_int INTEGER,
  tiebreaker_value NUMERIC,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

CREATE TABLE IF NOT EXISTS crown_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  event_type TEXT NOT NULL,
  event_ref_type TEXT,
  event_ref_id TEXT,
  amount_int INTEGER NOT NULL,
  meta_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_type, event_ref_type, event_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_crown_ledger_user_id ON crown_ledger(user_id);

CREATE TABLE IF NOT EXISTS crown_balance_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  total_crowns_int INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crown_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  status_level TEXT NOT NULL DEFAULT 'Squire',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sport_elo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  sport_id UUID REFERENCES sports(id),
  season_id UUID REFERENCES seasons(id),
  current_elo_int INTEGER NOT NULL DEFAULT 0,
  current_tier TEXT NOT NULL DEFAULT 'Bronze',
  champion_unlocked BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, sport_id, season_id)
);

CREATE TABLE IF NOT EXISTS elo_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id UUID REFERENCES sports(id),
  season_id UUID REFERENCES seasons(id),
  thresholds_json JSONB NOT NULL DEFAULT '{"Bronze":0,"Silver":500,"Gold":1500,"Champion":3000}',
  points_per_correct_pick_default_int INTEGER DEFAULT 25,
  points_per_incorrect_pick_champion_int INTEGER DEFAULT -15,
  visibility_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sport_id, season_id)
);

CREATE TABLE IF NOT EXISTS badge_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'TROPHY_ONLY' CHECK (type IN ('NAMETAG_BADGE', 'NAMETAG_SKIN', 'TROPHY_ONLY')),
  icon_asset_ref TEXT,
  rules_json JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badge_awards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  badge_id UUID REFERENCES badge_definitions(id),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  award_reason_json JSONB,
  UNIQUE (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS user_badge_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  nametag_skin_badge_id UUID REFERENCES badge_definitions(id),
  nametag_badge_ids_json JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS giveaway_months (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month_key TEXT NOT NULL UNIQUE,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'drawn')),
  prize_pool_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS giveaway_snapshot (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_month_id UUID REFERENCES giveaway_months(id),
  user_id UUID REFERENCES auth.users(id),
  crowns_at_lock_int INTEGER NOT NULL,
  entries_int INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (giveaway_month_id, user_id)
);

CREATE TABLE IF NOT EXISTS giveaway_winners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_month_id UUID REFERENCES giveaway_months(id),
  user_id UUID REFERENCES auth.users(id),
  drawn_at TIMESTAMPTZ DEFAULT now(),
  prize_json JSONB
);

CREATE TABLE IF NOT EXISTS user_weekly_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  week_key TEXT NOT NULL,
  has_entry BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, week_key)
);

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  current_streak_weeks_int INTEGER DEFAULT 0,
  best_streak_int INTEGER DEFAULT 0,
  last_week_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsor_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  multiplier_json JSONB,
  bonus_rules_json JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gamification_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  entry_crowns_per_contest INTEGER DEFAULT 10,
  first_time_bonus INTEGER DEFAULT 50,
  placement_1st INTEGER DEFAULT 200,
  placement_top10_pct INTEGER DEFAULT 100,
  placement_beat_avg INTEGER DEFAULT 25,
  streak_2_week INTEGER DEFAULT 50,
  streak_4_week INTEGER DEFAULT 150,
  streak_8_week INTEGER DEFAULT 400,
  referral_bonus INTEGER DEFAULT 100,
  share_bonus INTEGER DEFAULT 25,
  share_daily_limit INTEGER DEFAULT 3,
  nametag_badge_limit INTEGER DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- PART 3: ALTER EXISTING TABLES (add gamification columns)
-- ========================================

ALTER TABLE contests ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES sports(id);
ALTER TABLE contests ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id);
ALTER TABLE contests ADD COLUMN IF NOT EXISTS brand_id TEXT;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS contest_type TEXT DEFAULT 'weekly_picks';
ALTER TABLE contests ADD COLUMN IF NOT EXISTS rules_json JSONB;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS scoring_json JSONB;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS tiebreaker_json JSONB;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE contests ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS elo_points_override INTEGER;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS crown_placement_enabled BOOLEAN DEFAULT true;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- ========================================
-- PART 4: ROW LEVEL SECURITY
-- ========================================

-- Base tables
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticker_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Gamification tables
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE crown_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE crown_balance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE crown_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sport_elo ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badge_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_config ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PART 5: RLS POLICIES (all use IF NOT EXISTS pattern)
-- ========================================

-- Public read access for base content tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read contests') THEN
    CREATE POLICY "Public read contests" ON contests FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read products') THEN
    CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read news') THEN
    CREATE POLICY "Public read news" ON news FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read videos') THEN
    CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read promo_slides') THEN
    CREATE POLICY "Public read promo_slides" ON promo_slides FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read ticker_items') THEN
    CREATE POLICY "Public read ticker_items" ON ticker_items FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read avatar_parts') THEN
    CREATE POLICY "Public read avatar_parts" ON avatar_parts FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read room_items') THEN
    CREATE POLICY "Public read room_items" ON room_items FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read room_categories') THEN
    CREATE POLICY "Public read room_categories" ON room_categories FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read achievements') THEN
    CREATE POLICY "Public read achievements" ON achievements FOR SELECT USING (true);
  END IF;
END $$;

-- User profile policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own profile') THEN
    CREATE POLICY "Users read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own profile') THEN
    CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own profile') THEN
    CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- User contest policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own contests') THEN
    CREATE POLICY "Users read own contests" ON user_contests FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own contests') THEN
    CREATE POLICY "Users insert own contests" ON user_contests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own contests') THEN
    CREATE POLICY "Users update own contests" ON user_contests FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Admin policies for catalog management
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage avatar_parts') THEN
    CREATE POLICY "Admin manage avatar_parts" ON avatar_parts FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage room_items') THEN
    CREATE POLICY "Admin manage room_items" ON room_items FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage room_categories') THEN
    CREATE POLICY "Admin manage room_categories" ON room_categories FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- Gamification public read policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read sports') THEN
    CREATE POLICY "Public read sports" ON sports FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read seasons') THEN
    CREATE POLICY "Public read seasons" ON seasons FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read elo_config') THEN
    CREATE POLICY "Public read elo_config" ON elo_config FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read badge_definitions') THEN
    CREATE POLICY "Public read badge_definitions" ON badge_definitions FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read gamification_config') THEN
    CREATE POLICY "Public read gamification_config" ON gamification_config FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read giveaway_months') THEN
    CREATE POLICY "Public read giveaway_months" ON giveaway_months FOR SELECT USING (true);
  END IF;
END $$;

-- Gamification user-specific read policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own crown_ledger') THEN
    CREATE POLICY "Users read own crown_ledger" ON crown_ledger FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own crown_balance_cache') THEN
    CREATE POLICY "Users read own crown_balance_cache" ON crown_balance_cache FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own crown_status') THEN
    CREATE POLICY "Users read own crown_status" ON crown_status FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own user_sport_elo') THEN
    CREATE POLICY "Users read own user_sport_elo" ON user_sport_elo FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own badge_awards') THEN
    CREATE POLICY "Users read own badge_awards" ON badge_awards FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own user_badge_preferences') THEN
    CREATE POLICY "Users read own user_badge_preferences" ON user_badge_preferences FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own picks') THEN
    CREATE POLICY "Users read own picks" ON picks FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own pick_results') THEN
    CREATE POLICY "Users read own pick_results" ON pick_results FOR SELECT USING (
      EXISTS (SELECT 1 FROM picks WHERE picks.id = pick_results.pick_id AND picks.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read contest_scores') THEN
    CREATE POLICY "Public read contest_scores" ON contest_scores FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own user_weekly_activity') THEN
    CREATE POLICY "Users read own user_weekly_activity" ON user_weekly_activity FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own user_streaks') THEN
    CREATE POLICY "Users read own user_streaks" ON user_streaks FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own giveaway_snapshot') THEN
    CREATE POLICY "Users read own giveaway_snapshot" ON giveaway_snapshot FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read giveaway_winners') THEN
    CREATE POLICY "Public read giveaway_winners" ON giveaway_winners FOR SELECT USING (true);
  END IF;
END $$;

-- User INSERT policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own picks') THEN
    CREATE POLICY "Users insert own picks" ON picks FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own user_weekly_activity') THEN
    CREATE POLICY "Users insert own user_weekly_activity" ON user_weekly_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- User UPDATE policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own user_badge_preferences') THEN
    CREATE POLICY "Users update own user_badge_preferences" ON user_badge_preferences FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own user_badge_preferences') THEN
    CREATE POLICY "Users insert own user_badge_preferences" ON user_badge_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Admin full access policies for all gamification tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage sports') THEN
    CREATE POLICY "Admin manage sports" ON sports FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage seasons') THEN
    CREATE POLICY "Admin manage seasons" ON seasons FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage picks') THEN
    CREATE POLICY "Admin manage picks" ON picks FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage pick_results') THEN
    CREATE POLICY "Admin manage pick_results" ON pick_results FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage contest_scores') THEN
    CREATE POLICY "Admin manage contest_scores" ON contest_scores FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage crown_ledger') THEN
    CREATE POLICY "Admin manage crown_ledger" ON crown_ledger FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage crown_balance_cache') THEN
    CREATE POLICY "Admin manage crown_balance_cache" ON crown_balance_cache FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage crown_status') THEN
    CREATE POLICY "Admin manage crown_status" ON crown_status FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage user_sport_elo') THEN
    CREATE POLICY "Admin manage user_sport_elo" ON user_sport_elo FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage elo_config') THEN
    CREATE POLICY "Admin manage elo_config" ON elo_config FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage badge_definitions') THEN
    CREATE POLICY "Admin manage badge_definitions" ON badge_definitions FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage badge_awards') THEN
    CREATE POLICY "Admin manage badge_awards" ON badge_awards FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage user_badge_preferences') THEN
    CREATE POLICY "Admin manage user_badge_preferences" ON user_badge_preferences FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage giveaway_months') THEN
    CREATE POLICY "Admin manage giveaway_months" ON giveaway_months FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage giveaway_snapshot') THEN
    CREATE POLICY "Admin manage giveaway_snapshot" ON giveaway_snapshot FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage giveaway_winners') THEN
    CREATE POLICY "Admin manage giveaway_winners" ON giveaway_winners FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage user_weekly_activity') THEN
    CREATE POLICY "Admin manage user_weekly_activity" ON user_weekly_activity FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage user_streaks') THEN
    CREATE POLICY "Admin manage user_streaks" ON user_streaks FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage sponsor_campaigns') THEN
    CREATE POLICY "Admin manage sponsor_campaigns" ON sponsor_campaigns FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage gamification_config') THEN
    CREATE POLICY "Admin manage gamification_config" ON gamification_config FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ========================================
-- PART 6: AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, crowns)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    2450
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ========================================
-- PART 7: SEED DATA
-- ========================================

-- Base content seed data
INSERT INTO contests (title, sponsor, sponsor_logo, league, prize_pool, entries, max_entries, ends_at, crowns, is_premier) VALUES
  ('Super Bowl Showdown', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100', 'NFL', '$50,000', 8432, 10000, '2025-02-09T23:30:00Z', 500, true),
  ('March Madness Bracket Challenge', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=100', 'NCAAB', '$25,000', 5621, 8000, '2025-03-15T18:00:00Z', 350, false),
  ('NBA All-Star Picks', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=100', 'NBA', '$15,000', 3200, 5000, '2025-02-16T20:00:00Z', 250, false),
  ('Premier League Weekend', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=100', 'EPL', '$10,000', 2100, 3000, '2025-02-08T15:00:00Z', 200, false)
ON CONFLICT DO NOTHING;

INSERT INTO products (name, price, original_price, image, rating, reviews, badge, category, sizes, description) VALUES
  ('Fantasy Royale Champion Tee', 34.99, NULL, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', 4.8, 234, 'BEST SELLER', 'T-Shirts', ARRAY['S','M','L','XL','XXL'], 'Premium cotton tee with embroidered crown logo. Show off your fantasy sports dominance.'),
  ('Crown Logo Snapback', 29.99, 39.99, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400', 4.6, 156, 'LIMITED', 'Hats', NULL, 'Adjustable snapback with embroidered crown logo. One size fits most.'),
  ('Royale Hoodie', 59.99, NULL, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400', 4.9, 89, 'PREMIUM', 'Apparel', ARRAY['S','M','L','XL','XXL'], 'Ultra-soft fleece hoodie with gradient crown print. Perfect for game day.'),
  ('Victory Lap Tee', 29.99, NULL, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400', 4.5, 67, 'NEW', 'T-Shirts', ARRAY['S','M','L','XL'], 'Celebrate your wins with this premium graphic tee.'),
  ('Classic Dad Hat', 24.99, NULL, 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?w=400', 4.7, 112, NULL, 'Hats', NULL, 'Relaxed fit dad hat with subtle crown embroidery.')
ON CONFLICT DO NOTHING;

INSERT INTO news (source, headline) VALUES
  ('Fantasy Royale', 'Chiefs favored to win back-to-back Super Bowls as betting lines open'),
  ('Fantasy Royale', 'March Madness bracket predictions: Expert picks for the tournament'),
  ('Fantasy Royale', 'NBA Trade Deadline: Latest rumors and potential deals'),
  ('Fantasy Royale', 'Fantasy Football: Early rankings for next season released'),
  ('Fantasy Royale', 'Premier League title race heats up as top teams clash')
ON CONFLICT DO NOTHING;

INSERT INTO videos (username, caption, likes, comments, shares, category, thumbnail, is_live) VALUES
  ('AustinEkeler', 'My Super Bowl prediction is LOCKED IN', 12400, 892, 234, 'Predictions', 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400', false),
  ('FantasyPro_Mike', 'Called it! 5-0 on my picks this week', 8932, 456, 189, 'Celebrations', 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400', false),
  ('BracketMaster', 'LIVE: Breaking down the tournament matchups', 3421, 1205, 87, 'Live', 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400', true),
  ('GridironGuru', 'Why the Eagles are my dark horse pick', 6789, 567, 145, 'Predictions', 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400', false)
ON CONFLICT DO NOTHING;

INSERT INTO promo_slides (type, title, subtitle, sponsor, sort_order) VALUES
  ('gradient', 'Super Bowl LVIII', 'Enter FREE - Win $50K', 'Fantasy Royale', 0),
  ('gradient', 'March Madness', 'Bracket Challenge Opens Soon', 'Fantasy Royale', 1),
  ('gradient', 'NBA All-Star Weekend', 'Pick Your Winners', 'Fantasy Royale', 2),
  ('gradient', 'Premier League', 'Weekly Picks Contest', 'Fantasy Royale', 3)
ON CONFLICT DO NOTHING;

INSERT INTO ticker_items (text, sort_order) VALUES
  ('KC Chiefs 24 - SF 49ers 21 (Q4)', 0),
  ('Lakers 108 - Celtics 105 (Final)', 1),
  ('Yankees 5 - Dodgers 3 (8th)', 2),
  ('Rangers 3 - Bruins 2 (OT)', 3),
  ('Warriors 95 - Heat 88 (Q3)', 4)
ON CONFLICT DO NOTHING;

INSERT INTO avatar_parts (id, name, category, image, price, rarity, unlock_type, unlock_value, unlock_contest_id, unlock_achievement_id, is_default) VALUES
  ('body_default', 'Default Body', 'body', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('body_athletic', 'Athletic Build', 'body', '', 150, 'rare', 'crowns', 150, NULL, NULL, false),
  ('hair_short', 'Short Hair', 'hair', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('hair_long', 'Long Hair', 'hair', '', 75, 'common', 'crowns', 75, NULL, NULL, false),
  ('hair_mohawk', 'Mohawk', 'hair', '', 150, 'rare', 'crowns', 1000, NULL, NULL, false),
  ('eyes_default', 'Default Eyes', 'eyes', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('eyes_sunglasses', 'Sunglasses', 'eyes', '', 100, 'rare', 'crowns', 100, NULL, NULL, false),
  ('mouth_default', 'Default Mouth', 'mouth', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('mouth_smile', 'Big Smile', 'mouth', '', 50, 'common', 'crowns', 50, NULL, NULL, false),
  ('shirt_default', 'Basic Tee', 'shirt', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('shirt_jersey', 'Sports Jersey', 'shirt', '', 200, 'rare', 'contest_entry', NULL, '1', NULL, false),
  ('shirt_hoodie', 'Champion Hoodie', 'shirt', '', 300, 'epic', 'crowns', 300, NULL, NULL, false),
  ('jacket_none', 'No Jacket', 'jacket', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('jacket_blazer', 'Victory Blazer', 'jacket', '', 400, 'epic', 'achievement', NULL, NULL, 'first_win', false),
  ('pants_default', 'Basic Pants', 'pants', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('pants_shorts', 'Athletic Shorts', 'pants', '', 75, 'common', 'crowns', 75, NULL, NULL, false),
  ('shoes_default', 'Sneakers', 'shoes', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('shoes_gold', 'Gold Kicks', 'shoes', '', 500, 'legendary', 'crowns', 500, NULL, NULL, false),
  ('acc_none', 'No Accessories', 'accessories', '', 0, 'common', 'free', NULL, NULL, NULL, true),
  ('acc_chain', 'Gold Chain', 'accessories', '', 350, 'epic', 'crowns', 350, NULL, NULL, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO room_items (id, name, category, image, price, rarity, unlock_type, unlock_value, unlock_contest_id, unlock_achievement_id, url, width, depth, z_height, placement_surface, is_stackable, wall_side) VALUES
  ('floor_wood', 'Wood Floor', 'flooring', '', 0, 'common', 'free', NULL, NULL, NULL, NULL, 1, 1, 0, 'floor', false, NULL),
  ('floor_marble', 'Marble Floor', 'flooring', '', 200, 'rare', 'crowns', 200, NULL, NULL, NULL, 1, 1, 0, 'floor', false, NULL),
  ('wall_basic', 'Basic Wall', 'wall', '', 0, 'common', 'free', NULL, NULL, NULL, NULL, 1, 1, 4, 'wall', false, NULL),
  ('wall_sports', 'Sports Wall', 'wall', '', 150, 'rare', 'contest_entry', NULL, '1', NULL, NULL, 1, 1, 4, 'wall', false, 'left'),
  ('sofa_basic', 'Basic Sofa', 'furniture', '', 100, 'common', 'crowns', 100, NULL, NULL, NULL, 2, 1, 1, 'floor', false, NULL),
  ('sofa_luxury', 'Luxury Sofa', 'furniture', '', 400, 'epic', 'crowns', 400, NULL, NULL, NULL, 3, 1, 1, 'floor', false, NULL),
  ('table_coffee', 'Coffee Table', 'furniture', '', 75, 'common', 'crowns', 75, NULL, NULL, NULL, 1, 1, 1, 'floor', true, NULL),
  ('tv_basic', 'TV Screen', 'tech', '', 200, 'rare', 'crowns', 200, NULL, NULL, 'https://fantasyroyale.com/live', 2, 1, 2, 'wall', false, NULL),
  ('tv_giant', 'Giant Screen', 'tech', '', 600, 'legendary', 'crowns', 600, NULL, NULL, 'https://fantasyroyale.com/live', 3, 2, 3, 'wall', false, NULL),
  ('trophy_bronze', 'Bronze Trophy', 'trophy', '', 0, 'rare', 'achievement', NULL, NULL, 'first_win', NULL, 1, 1, 1, 'stacked', false, NULL),
  ('trophy_silver', 'Silver Trophy', 'trophy', '', 0, 'epic', 'achievement', NULL, NULL, 'five_wins', NULL, 1, 1, 1, 'stacked', false, NULL),
  ('trophy_gold', 'Gold Trophy', 'trophy', '', 0, 'legendary', 'achievement', NULL, NULL, 'ten_wins', NULL, 1, 1, 1, 'stacked', false, NULL),
  ('plant_small', 'Small Plant', 'decor', '', 50, 'common', 'crowns', 50, NULL, NULL, NULL, 1, 1, 1, 'floor', true, NULL),
  ('poster_team', 'Team Poster', 'decor', '', 100, 'rare', 'contest_entry', NULL, '2', NULL, 'https://fantasyroyale.com/teams', 1, 1, 2, 'wall', false, NULL),
  ('gaming_chair', 'Gaming Chair', 'furniture', '', 300, 'epic', 'crowns', 300, NULL, NULL, NULL, 1, 1, 2, 'floor', false, NULL),
  ('neon_sign', 'Neon Crown Sign', 'decor', '', 500, 'legendary', 'crowns', 500, NULL, NULL, NULL, 2, 1, 1, 'wall', false, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO room_categories (name, sort_order) VALUES
  ('furniture', 0), ('decor', 1), ('flooring', 2), ('wall', 3), ('trophy', 4), ('tech', 5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO achievements (id, name, description, icon, condition_type, condition_value, reward) VALUES
  ('first_win', 'First Victory', 'Win your first contest', 'trophy', 'wins', 1, 100),
  ('five_wins', 'Rising Star', 'Win 5 contests', 'star', 'wins', 5, 250),
  ('ten_wins', 'Champion', 'Win 10 contests', 'medal', 'wins', 10, 500),
  ('contest_10', 'Competitor', 'Enter 10 contests', 'flag', 'contests', 10, 150),
  ('streak_5', 'Hot Streak', 'Win 5 contests in a row', 'flame', 'streak', 5, 300),
  ('collector', 'Collector', 'Own 20 avatar parts', 'grid', 'avatar_parts', 20, 200),
  ('decorator', 'Decorator', 'Place 10 items in your room', 'home', 'room_items', 10, 200)
ON CONFLICT (id) DO NOTHING;

-- Gamification seed data
INSERT INTO gamification_config (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

INSERT INTO sports (name) VALUES
  ('Basketball'),
  ('Football'),
  ('Baseball'),
  ('Soccer'),
  ('Hockey')
ON CONFLICT (name) DO NOTHING;

INSERT INTO badge_definitions (code, name, description, type, rules_json) VALUES
  ('first_entry', 'First Entry', 'Awarded for entering your first contest', 'TROPHY_ONLY', '{"trigger":"contest_entry","threshold":1}'),
  ('first_win', 'First Victory', 'Awarded for winning your first contest', 'NAMETAG_BADGE', '{"trigger":"contest_win","threshold":1}'),
  ('crown_knight', 'Crown Knight', 'Reached Knight status in the Crown system', 'NAMETAG_BADGE', '{"trigger":"crown_status","required_status":"Knight"}'),
  ('crown_royalty', 'Crown Royalty', 'Reached Royalty status in the Crown system', 'NAMETAG_SKIN', '{"trigger":"crown_status","required_status":"Royalty"}'),
  ('streak_2', 'Two-Week Warrior', 'Maintained a 2-week activity streak', 'TROPHY_ONLY', '{"trigger":"streak","weeks":2}'),
  ('streak_4', 'Month of Glory', 'Maintained a 4-week activity streak', 'NAMETAG_BADGE', '{"trigger":"streak","weeks":4}'),
  ('streak_8', 'Iron Will', 'Maintained an 8-week activity streak', 'NAMETAG_SKIN', '{"trigger":"streak","weeks":8}'),
  ('champion_basketball', 'Basketball Champion', 'Reached Champion tier in Basketball', 'NAMETAG_BADGE', '{"trigger":"elo_tier","sport":"Basketball","required_tier":"Champion"}'),
  ('giveaway_winner', 'Lucky Crown', 'Won a monthly Crown giveaway', 'NAMETAG_SKIN', '{"trigger":"giveaway_win"}')
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- DONE! All 32 tables created, RLS enabled, policies set, seed data loaded.
-- ========================================
