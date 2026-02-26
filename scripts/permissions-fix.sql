-- Fantasy Royale - Permissions Fix
-- Run this in Supabase SQL Editor to grant access to all gamification tables
-- The service_role needs explicit grants on custom tables

-- Grant all permissions to service_role (backend) and authenticated (logged-in users)
-- on all gamification tables

GRANT ALL ON TABLE user_profiles TO service_role, authenticated;
GRANT ALL ON TABLE contests TO service_role, authenticated;
GRANT ALL ON TABLE matchups TO service_role, authenticated;
GRANT ALL ON TABLE contest_entries TO service_role, authenticated;
GRANT ALL ON TABLE contest_picks TO service_role, authenticated;
GRANT ALL ON TABLE contest_results TO service_role, authenticated;
GRANT ALL ON TABLE crown_ledger TO service_role, authenticated;
GRANT ALL ON TABLE user_sport_elo TO service_role, authenticated;
GRANT ALL ON TABLE elo_config TO service_role, authenticated;
GRANT ALL ON TABLE badge_definitions TO service_role, authenticated;
GRANT ALL ON TABLE badge_awards TO service_role, authenticated;
GRANT ALL ON TABLE user_badge_preferences TO service_role, authenticated;
GRANT ALL ON TABLE giveaway_months TO service_role, authenticated;
GRANT ALL ON TABLE giveaway_snapshot TO service_role, authenticated;
GRANT ALL ON TABLE giveaway_winners TO service_role, authenticated;
GRANT ALL ON TABLE user_weekly_activity TO service_role, authenticated;
GRANT ALL ON TABLE user_streaks TO service_role, authenticated;
GRANT ALL ON TABLE gamification_config TO service_role, authenticated;
GRANT ALL ON TABLE sports TO service_role, authenticated;
GRANT ALL ON TABLE seasons TO service_role, authenticated;
GRANT ALL ON TABLE sponsor_campaigns TO service_role, authenticated;
GRANT ALL ON TABLE products TO service_role, authenticated;
GRANT ALL ON TABLE news_articles TO service_role, authenticated;
GRANT ALL ON TABLE videos TO service_role, authenticated;
GRANT ALL ON TABLE achievements TO service_role, authenticated;
GRANT ALL ON TABLE social_posts TO service_role, authenticated;
GRANT ALL ON TABLE social_comments TO service_role, authenticated;
GRANT ALL ON TABLE social_likes TO service_role, authenticated;

-- Phase 2 tables
GRANT ALL ON TABLE rule_sets TO service_role, authenticated;
GRANT ALL ON TABLE notifications TO service_role, authenticated;
GRANT ALL ON TABLE activity_feed TO service_role, authenticated;
GRANT ALL ON TABLE audit_log TO service_role, authenticated;
GRANT ALL ON TABLE fraud_flags TO service_role, authenticated;
GRANT ALL ON TABLE referral_tracking TO service_role, authenticated;

-- Also grant SELECT to anon role for public-read tables
GRANT SELECT ON TABLE contests TO anon;
GRANT SELECT ON TABLE matchups TO anon;
GRANT SELECT ON TABLE sports TO anon;
GRANT SELECT ON TABLE seasons TO anon;
GRANT SELECT ON TABLE products TO anon;
GRANT SELECT ON TABLE news_articles TO anon;
GRANT SELECT ON TABLE videos TO anon;
GRANT SELECT ON TABLE badge_definitions TO anon;
GRANT SELECT ON TABLE elo_config TO anon;
GRANT SELECT ON TABLE gamification_config TO anon;
GRANT SELECT ON TABLE achievements TO anon;
GRANT SELECT ON TABLE sponsor_campaigns TO anon;
GRANT SELECT ON TABLE social_posts TO anon;
GRANT SELECT ON TABLE social_comments TO anon;
GRANT SELECT ON TABLE activity_feed TO anon;

-- Verify the seed data exists (re-insert if missing)
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
