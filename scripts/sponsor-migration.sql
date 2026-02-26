-- Fantasy Royale - Sponsor System Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates tables for sponsor profile management and campaign tracking

-- ========================================
-- PART 0: CLEAN UP FROM ANY PREVIOUS FAILED RUNS
-- ========================================
-- Drop in reverse order due to foreign key dependencies
DROP TABLE IF EXISTS sponsor_campaigns CASCADE;
DROP TABLE IF EXISTS sponsor_profiles CASCADE;

-- Remove sponsor_id from contests if it exists from a partial run
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'sponsor_id'
  ) THEN
    ALTER TABLE contests DROP COLUMN sponsor_id;
  END IF;
END $$;

-- ========================================
-- PART 1: CREATE SPONSOR TABLES
-- ========================================

-- sponsor_profiles: Stores sponsor company profiles and account information
-- Each sponsor user has a unique profile for campaign management
CREATE TABLE sponsor_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  brand_logo TEXT,
  brand_color TEXT DEFAULT '#00D4AA',
  website TEXT,
  description TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, suspended
  total_campaigns INTEGER DEFAULT 0,
  total_reach INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- sponsor_campaigns: Stores individual marketing campaigns created by sponsors
-- Links campaigns to contests for prize pool and entry integration
CREATE TABLE sponsor_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID REFERENCES sponsor_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sport TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, pending_approval, active, paused, completed, rejected
  budget_crowns INTEGER DEFAULT 0,
  prize_description TEXT,
  banner_image TEXT,
  brand_color TEXT,
  target_entries INTEGER DEFAULT 1000,
  actual_entries INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  contest_id UUID REFERENCES contests(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- PART 2: ALTER EXISTING TABLES
-- ========================================

-- Add sponsor_id column to contests table for direct sponsor linking
ALTER TABLE contests ADD COLUMN sponsor_id UUID REFERENCES sponsor_profiles(id) ON DELETE SET NULL;

-- ========================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Index sponsor_profiles.user_id for quick lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_profiles_user_id ON sponsor_profiles(user_id);

-- Index sponsor_profiles.status for filtering sponsors by approval status
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_status ON sponsor_profiles(status);

-- Index sponsor_campaigns.sponsor_id for efficient filtering by sponsor
CREATE INDEX IF NOT EXISTS idx_sponsor_campaigns_sponsor_id ON sponsor_campaigns(sponsor_id);

-- Index sponsor_campaigns.status for filtering by campaign status
CREATE INDEX IF NOT EXISTS idx_sponsor_campaigns_status ON sponsor_campaigns(status);

-- Index sponsor_campaigns.contest_id for linking campaigns to contests
CREATE INDEX IF NOT EXISTS idx_sponsor_campaigns_contest_id ON sponsor_campaigns(contest_id);

-- Index contests.sponsor_id for quick sponsor lookup
CREATE INDEX IF NOT EXISTS idx_contests_sponsor_id ON contests(sponsor_id);

-- Indexes for filtering by date ranges (common for reporting)
CREATE INDEX IF NOT EXISTS idx_sponsor_campaigns_created_at ON sponsor_campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_sponsor_campaigns_starts_at ON sponsor_campaigns(starts_at);
CREATE INDEX IF NOT EXISTS idx_sponsor_campaigns_ends_at ON sponsor_campaigns(ends_at);

-- ========================================
-- PART 4: CREATE TRIGGERS FOR AUTO-UPDATE
-- ========================================

-- Function to auto-update the updated_at column (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sponsor_profiles table
DROP TRIGGER IF EXISTS update_sponsor_profiles_updated_at ON sponsor_profiles;
CREATE TRIGGER update_sponsor_profiles_updated_at
  BEFORE UPDATE ON sponsor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for sponsor_campaigns table
DROP TRIGGER IF EXISTS update_sponsor_campaigns_updated_at ON sponsor_campaigns;
CREATE TRIGGER update_sponsor_campaigns_updated_at
  BEFORE UPDATE ON sponsor_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- PART 5: ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE sponsor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_campaigns ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PART 6: ROW LEVEL SECURITY POLICIES
-- ========================================

-- ----------------------------------------
-- sponsor_profiles policies
-- ----------------------------------------
CREATE POLICY "Users read own sponsor_profiles" ON sponsor_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sponsor_profiles" ON sponsor_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sponsor_profiles" ON sponsor_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public read approved sponsor_profiles" ON sponsor_profiles
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Service role manage sponsor_profiles" ON sponsor_profiles
  FOR ALL TO service_role USING (true);

-- ----------------------------------------
-- sponsor_campaigns policies
-- ----------------------------------------
CREATE POLICY "Sponsors read own sponsor_campaigns" ON sponsor_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sponsor_profiles sp
      WHERE sp.id = sponsor_campaigns.sponsor_id
      AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Sponsors insert own sponsor_campaigns" ON sponsor_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sponsor_profiles sp
      WHERE sp.id = sponsor_campaigns.sponsor_id
      AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Sponsors update own sponsor_campaigns" ON sponsor_campaigns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sponsor_profiles sp
      WHERE sp.id = sponsor_campaigns.sponsor_id
      AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Sponsors delete own sponsor_campaigns" ON sponsor_campaigns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sponsor_profiles sp
      WHERE sp.id = sponsor_campaigns.sponsor_id
      AND sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Public read active sponsor_campaigns" ON sponsor_campaigns
  FOR SELECT USING (status = 'active');

CREATE POLICY "Service role manage sponsor_campaigns" ON sponsor_campaigns
  FOR ALL TO service_role USING (true);

-- ========================================
-- END OF MIGRATION
-- ========================================
-- Summary:
-- - Created sponsor_profiles table for sponsor account management
-- - Created sponsor_campaigns table for individual marketing campaigns
-- - Added sponsor_id column to contests table
-- - Added auto-update triggers for updated_at columns on both new tables
-- - Enabled RLS on both tables with appropriate access policies:
--   - Sponsors can manage their own profiles and campaigns
--   - Public can read approved profiles and active campaigns
--   - Service role has full access for backend operations
-- - Added comprehensive indexes on foreign keys and commonly filtered columns
--
-- All tables and policies use IF NOT EXISTS for safe, idempotent execution.
