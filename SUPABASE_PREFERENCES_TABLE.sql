-- User Preferences Table
-- Run this in Supabase SQL Editor to create the user_preferences table
-- This stores notification and privacy settings per user for cross-device sync

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification preferences (8 toggles)
  notif_contest_reminders BOOLEAN NOT NULL DEFAULT true,
  notif_contest_results BOOLEAN NOT NULL DEFAULT true,
  notif_giveaway_alerts BOOLEAN NOT NULL DEFAULT true,
  notif_badge_awards BOOLEAN NOT NULL DEFAULT true,
  notif_streak_reminders BOOLEAN NOT NULL DEFAULT true,
  notif_crown_updates BOOLEAN NOT NULL DEFAULT true,
  notif_social_activity BOOLEAN NOT NULL DEFAULT false,
  notif_marketing_emails BOOLEAN NOT NULL DEFAULT false,
  
  -- Privacy preferences (7 toggles)
  privacy_profile_public BOOLEAN NOT NULL DEFAULT true,
  privacy_show_contest_history BOOLEAN NOT NULL DEFAULT true,
  privacy_show_badges BOOLEAN NOT NULL DEFAULT true,
  privacy_show_streak BOOLEAN NOT NULL DEFAULT true,
  privacy_show_crown_status BOOLEAN NOT NULL DEFAULT false,
  privacy_show_in_leaderboards BOOLEAN NOT NULL DEFAULT true,
  privacy_allow_referrals BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_user_preferences UNIQUE (user_id)
);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to user_preferences" ON user_preferences;
CREATE POLICY "Service role full access to user_preferences" ON user_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- Grant table permissions to all roles (required for service_role access)
GRANT ALL ON user_preferences TO service_role;
GRANT ALL ON user_preferences TO authenticated;
GRANT SELECT ON user_preferences TO anon;
