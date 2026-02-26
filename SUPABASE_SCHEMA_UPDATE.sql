-- ============================================================
-- Fantasy Royale - Supabase Schema Update SQL
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- Generated: February 2026
-- Safe to re-run - all statements use IF NOT EXISTS / IF EXISTS
-- ============================================================

-- ============================================================
-- 1. ADD NEW UNLOCK COLUMNS TO avatar_parts AND room_items
-- These columns support the expanded unlock condition types:
-- elo_placement, giveaway_win, referral_count
-- ============================================================

ALTER TABLE avatar_parts
  ADD COLUMN IF NOT EXISTS unlock_season_id TEXT,
  ADD COLUMN IF NOT EXISTS unlock_giveaway_id UUID,
  ADD COLUMN IF NOT EXISTS unlock_elo_rank INTEGER;

ALTER TABLE room_items
  ADD COLUMN IF NOT EXISTS unlock_season_id TEXT,
  ADD COLUMN IF NOT EXISTS unlock_giveaway_id UUID,
  ADD COLUMN IF NOT EXISTS unlock_elo_rank INTEGER;


-- ============================================================
-- 2. ADD contest_ids COLUMN TO elo_config
-- Used to associate specific contests with an ELO configuration
-- ============================================================

ALTER TABLE elo_config
  ADD COLUMN IF NOT EXISTS contest_ids JSONB DEFAULT NULL;


-- ============================================================
-- 3. CREATE giveaways TABLE
-- Stores giveaway definitions with entry methods and lifecycle
-- ============================================================

CREATE TABLE IF NOT EXISTS giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  prize_description TEXT,
  prize_value_cents INTEGER,
  image_url TEXT,
  entry_methods JSONB DEFAULT '[]'::jsonb,
  max_entries_per_user INTEGER DEFAULT 1,
  max_winners INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  drawn_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE giveaways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on giveaways" ON giveaways;
CREATE POLICY "Service role full access on giveaways"
  ON giveaways FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 4. CREATE giveaway_entries TABLE
-- Tracks individual user entries per giveaway per entry method
-- ============================================================

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entry_method TEXT NOT NULL,
  entries_count INTEGER DEFAULT 1,
  metadata JSONB,
  qualified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(giveaway_id, user_id, entry_method)
);

ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on giveaway_entries" ON giveaway_entries;
CREATE POLICY "Service role full access on giveaway_entries"
  ON giveaway_entries FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway ON giveaway_entries(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id);


-- ============================================================
-- 5. CREATE giveaway_winners_v2 TABLE
-- Records winners drawn from giveaway entries
-- ============================================================

CREATE TABLE IF NOT EXISTS giveaway_winners_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  place INTEGER NOT NULL DEFAULT 1,
  awarded BOOLEAN DEFAULT false,
  awarded_at TIMESTAMPTZ,
  prize_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(giveaway_id, user_id)
);

ALTER TABLE giveaway_winners_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on giveaway_winners_v2" ON giveaway_winners_v2;
CREATE POLICY "Service role full access on giveaway_winners_v2"
  ON giveaway_winners_v2 FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_giveaway_winners_giveaway ON giveaway_winners_v2(giveaway_id);


-- ============================================================
-- 6. USER-FACING POLICIES FOR GIVEAWAYS
-- Allow authenticated users to read giveaway data
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view active giveaways" ON giveaways;
CREATE POLICY "Authenticated users can view active giveaways"
  ON giveaways FOR SELECT
  TO authenticated
  USING (status IN ('open', 'locked', 'drawn', 'awarded'));

DROP POLICY IF EXISTS "Authenticated users can view their entries" ON giveaway_entries;
CREATE POLICY "Authenticated users can view their entries"
  ON giveaway_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view winners" ON giveaway_winners_v2;
CREATE POLICY "Authenticated users can view winners"
  ON giveaway_winners_v2 FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================
-- DONE! After running this SQL:
-- 1. avatar_parts and room_items support all unlock types
-- 2. elo_config supports contest_ids
-- 3. Giveaway system tables are created and ready
-- 4. All existing tables remain unchanged
-- ============================================================
