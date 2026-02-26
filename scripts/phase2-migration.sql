-- Fantasy Royale - Phase 2 Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to run multiple times - uses CREATE TABLE IF NOT EXISTS and IF NOT EXISTS checks
-- ADDITIVE ONLY - extends existing gamification system with new tables

-- ========================================
-- PART 1: NEW TABLES
-- ========================================

-- 1. rule_sets (versioned, scoped config)
CREATE TABLE IF NOT EXISTS rule_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_type TEXT NOT NULL DEFAULT 'GLOBAL' CHECK (scope_type IN ('GLOBAL','SPORT','SEASON','CONTEST','SPONSOR')),
  scope_id UUID,
  version_int INTEGER NOT NULL DEFAULT 1,
  rules_json JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_rule_sets_scope ON rule_sets(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_rule_sets_active ON rule_sets(scope_type, scope_id, is_active) WHERE is_active = true;

-- 2. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  meta JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- 3. activity_feed (global feed)
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  verb TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id, created_at DESC);

-- 4. audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- 5. fraud_flags
CREATE TABLE IF NOT EXISTS fraud_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  flag_type TEXT NOT NULL,
  severity INTEGER NOT NULL DEFAULT 1,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_unresolved ON fraud_flags(user_id) WHERE resolved_at IS NULL;

-- 6. referral_tracking
CREATE TABLE IF NOT EXISTS referral_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID REFERENCES auth.users(id) NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired')),
  completed_at TIMESTAMPTZ,
  crowns_awarded_referrer BOOLEAN DEFAULT false,
  crowns_awarded_referred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referral_tracking(referrer_user_id);

-- ========================================
-- PART 2: ALTER EXISTING TABLES
-- ========================================

-- 7. Add referral_code column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 8. Add idempotency_key to badge_awards (if missing)
ALTER TABLE badge_awards ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- ========================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PART 4: RLS POLICIES
-- ========================================

-- ----------------------------------------
-- rule_sets: Public read for active rules. Admin manage all.
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read active rule_sets') THEN
    CREATE POLICY "Public read active rule_sets" ON rule_sets FOR SELECT USING (is_active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage rule_sets') THEN
    CREATE POLICY "Admin manage rule_sets" ON rule_sets FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ----------------------------------------
-- notifications: Users read own. Users update own (mark read). Admin insert.
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own notifications') THEN
    CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own notifications') THEN
    CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin insert notifications') THEN
    CREATE POLICY "Admin insert notifications" ON notifications FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage notifications') THEN
    CREATE POLICY "Admin manage notifications" ON notifications FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ----------------------------------------
-- activity_feed: Public read. Admin manage all.
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read activity_feed') THEN
    CREATE POLICY "Public read activity_feed" ON activity_feed FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage activity_feed') THEN
    CREATE POLICY "Admin manage activity_feed" ON activity_feed FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ----------------------------------------
-- audit_log: Admin read only. Admin insert.
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin read audit_log') THEN
    CREATE POLICY "Admin read audit_log" ON audit_log FOR SELECT USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin insert audit_log') THEN
    CREATE POLICY "Admin insert audit_log" ON audit_log FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ----------------------------------------
-- fraud_flags: Admin read and manage.
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage fraud_flags') THEN
    CREATE POLICY "Admin manage fraud_flags" ON fraud_flags FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ----------------------------------------
-- referral_tracking: Users read own. Admin manage all.
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own referral_tracking') THEN
    CREATE POLICY "Users read own referral_tracking" ON referral_tracking FOR SELECT USING (
      auth.uid() = referrer_user_id OR auth.uid() = referred_user_id
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage referral_tracking') THEN
    CREATE POLICY "Admin manage referral_tracking" ON referral_tracking FOR ALL USING (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

-- ========================================
-- PART 5: SEED DATA
-- ========================================

INSERT INTO rule_sets (scope_type, scope_id, version_int, is_active, rules_json) VALUES (
  'GLOBAL', NULL, 1, true, '{
    "crowns": {
      "contest_entry": 10,
      "first_time_entry_bonus": 50,
      "placement_1st": 200,
      "placement_top10_pct": 100,
      "placement_beat_avg": 25,
      "streak_2_week": 50,
      "streak_4_week": 150,
      "streak_8_week": 400,
      "referral_referrer": 100,
      "referral_referred": 100,
      "share_leaderboard": 25,
      "share_daily_limit": 3
    },
    "crown_status_thresholds": {
      "Squire": [0, 500],
      "Knight": [501, 2000],
      "Baron": [2001, 5000],
      "Duke": [5001, 10000],
      "Royalty": [10001, null]
    },
    "elo": {
      "default_correct_points": 25,
      "default_incorrect_champion_points": -15,
      "default_thresholds": {"Bronze": 0, "Silver": 500, "Gold": 1500, "Champion": 3000},
      "champion_leaderboard_visible": true,
      "pre_champion_leaderboard_visible": false
    },
    "giveaway": {
      "entries_per_crown": 1,
      "require_monthly_entry": true,
      "max_wins_per_user_per_month": 1
    },
    "badges": {
      "nametag_badge_limit": 3
    }
  }'
) ON CONFLICT DO NOTHING;
