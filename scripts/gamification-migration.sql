-- Fantasy Royale - Gamification Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to run multiple times - uses CREATE TABLE IF NOT EXISTS and IF NOT EXISTS checks
-- ADDITIVE ONLY - no drops of existing tables

-- ========================================
-- 1. NEW TABLES
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
-- 2. ALTER EXISTING TABLES
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
-- 3. ROW LEVEL SECURITY
-- ========================================

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

-- ----------------------------------------
-- Public read policies
-- ----------------------------------------

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

-- ----------------------------------------
-- User-specific read policies (own data)
-- ----------------------------------------

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

-- ----------------------------------------
-- User INSERT policies
-- ----------------------------------------

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

-- ----------------------------------------
-- User UPDATE policies
-- ----------------------------------------

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

-- ----------------------------------------
-- Admin full access policies (all new tables)
-- ----------------------------------------

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
-- 4. SEED DATA
-- ========================================

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
