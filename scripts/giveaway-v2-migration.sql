-- Giveaway V2 Migration
-- Run this in Supabase SQL Editor
-- Adds flexible giveaway system with multiple entry methods

-- ============================================================
-- 1. Enhanced giveaways table (replaces rigid monthly model)
-- ============================================================
CREATE TABLE IF NOT EXISTS giveaways (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  prize_description TEXT,
  prize_value_cents INTEGER,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'locked', 'drawn', 'awarded', 'cancelled')),
  entry_methods JSONB NOT NULL DEFAULT '[]',
  max_entries_per_user INTEGER DEFAULT 1,
  max_winners INTEGER DEFAULT 1,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  drawn_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Entry methods JSONB format:
-- [
--   { "type": "crown_threshold", "config": { "min_crowns": 500 }, "entries_awarded": 1 },
--   { "type": "contest_entry", "config": { "contest_id": "uuid" }, "entries_awarded": 1 },
--   { "type": "contest_placement", "config": { "contest_id": "uuid", "max_place": 10 }, "entries_awarded": 3 },
--   { "type": "referral", "config": { "min_referrals": 1 }, "entries_awarded": 2 },
--   { "type": "streak", "config": { "min_weeks": 4 }, "entries_awarded": 2 },
--   { "type": "social_share", "config": { "min_shares": 1 }, "entries_awarded": 1 },
--   { "type": "badge_holder", "config": { "badge_code": "some_badge" }, "entries_awarded": 1 },
--   { "type": "free", "config": {}, "entries_awarded": 1 }
-- ]

-- ============================================================
-- 2. Giveaway entries table (tracks each user's qualified entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS giveaway_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entry_method TEXT NOT NULL,
  entries_count INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  qualified_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (giveaway_id, user_id, entry_method)
);

-- ============================================================
-- 3. Giveaway winners table (drawn winners)
-- ============================================================
CREATE TABLE IF NOT EXISTS giveaway_winners_v2 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  place INTEGER,
  prize_details JSONB,
  awarded BOOLEAN DEFAULT FALSE,
  awarded_at TIMESTAMPTZ,
  drawn_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (giveaway_id, user_id)
);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status);
CREATE INDEX IF NOT EXISTS idx_giveaways_dates ON giveaways(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway ON giveaway_entries(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_winners_v2_giveaway ON giveaway_winners_v2(giveaway_id);

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_winners_v2 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read giveaways') THEN
    CREATE POLICY "Public read giveaways" ON giveaways FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own giveaway_entries') THEN
    CREATE POLICY "Users read own giveaway_entries" ON giveaway_entries FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read giveaway_winners_v2') THEN
    CREATE POLICY "Public read giveaway_winners_v2" ON giveaway_winners_v2 FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage giveaways') THEN
    CREATE POLICY "Admin manage giveaways" ON giveaways FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage giveaway_entries') THEN
    CREATE POLICY "Admin manage giveaway_entries" ON giveaway_entries FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage giveaway_winners_v2') THEN
    CREATE POLICY "Admin manage giveaway_winners_v2" ON giveaway_winners_v2 FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ============================================================
-- 6. Crown share tracking table (for social_share entry method)
-- ============================================================
CREATE TABLE IF NOT EXISTS crown_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  share_type TEXT NOT NULL DEFAULT 'general',
  shared_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crown_shares_user ON crown_shares(user_id);

ALTER TABLE crown_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own crown_shares') THEN
    CREATE POLICY "Users read own crown_shares" ON crown_shares FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage crown_shares') THEN
    CREATE POLICY "Admin manage crown_shares" ON crown_shares FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;
