-- Fantasy Royale - Fix Script
-- Run this FIRST to clean up any partial state, then re-run the main schema

-- Drop the achievements table if it exists with wrong schema
DROP TABLE IF EXISTS achievements CASCADE;

-- Recreate achievements with correct columns
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL,
  reward INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read achievements" ON achievements FOR SELECT USING (true);

-- Seed achievements
INSERT INTO achievements (id, name, description, icon, condition_type, condition_value, reward) VALUES
  ('first_win', 'First Victory', 'Win your first contest', 'trophy', 'wins', 1, 100),
  ('five_wins', 'Rising Star', 'Win 5 contests', 'star', 'wins', 5, 250),
  ('ten_wins', 'Champion', 'Win 10 contests', 'medal', 'wins', 10, 500),
  ('contest_10', 'Competitor', 'Enter 10 contests', 'flag', 'contests', 10, 150),
  ('streak_5', 'Hot Streak', 'Win 5 contests in a row', 'flame', 'streak', 5, 300),
  ('collector', 'Collector', 'Own 20 avatar parts', 'grid', 'avatar_parts', 20, 200),
  ('decorator', 'Decorator', 'Place 10 items in your room', 'home', 'room_items', 10, 200);
