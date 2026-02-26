-- Fantasy Royale - Supabase Database Setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ========================================
-- 1. CREATE TABLES
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
-- 2. ROW LEVEL SECURITY
-- ========================================

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

-- Public read access for content tables
CREATE POLICY "Public read contests" ON contests FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read news" ON news FOR SELECT USING (true);
CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Public read promo_slides" ON promo_slides FOR SELECT USING (true);
CREATE POLICY "Public read ticker_items" ON ticker_items FOR SELECT USING (true);
CREATE POLICY "Public read avatar_parts" ON avatar_parts FOR SELECT USING (true);
CREATE POLICY "Public read room_items" ON room_items FOR SELECT USING (true);
CREATE POLICY "Public read room_categories" ON room_categories FOR SELECT USING (true);
CREATE POLICY "Public read achievements" ON achievements FOR SELECT USING (true);

-- User profile policies
CREATE POLICY "Users read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- User contest policies
CREATE POLICY "Users read own contests" ON user_contests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own contests" ON user_contests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own contests" ON user_contests FOR UPDATE USING (auth.uid() = user_id);

-- Admin policies for catalog management
CREATE POLICY "Admin manage avatar_parts" ON avatar_parts FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admin manage room_items" ON room_items FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admin manage room_categories" ON room_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ========================================
-- 3. AUTO-CREATE PROFILE ON SIGNUP
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
-- 4. SEED DEMO DATA
-- ========================================

-- Contests
INSERT INTO contests (title, sponsor, sponsor_logo, league, prize_pool, entries, max_entries, ends_at, crowns, is_premier) VALUES
  ('Super Bowl Showdown', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100', 'NFL', '$50,000', 8432, 10000, '2025-02-09T23:30:00Z', 500, true),
  ('March Madness Bracket Challenge', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=100', 'NCAAB', '$25,000', 5621, 8000, '2025-03-15T18:00:00Z', 350, false),
  ('NBA All-Star Picks', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=100', 'NBA', '$15,000', 3200, 5000, '2025-02-16T20:00:00Z', 250, false),
  ('Premier League Weekend', 'Fantasy Royale', 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=100', 'EPL', '$10,000', 2100, 3000, '2025-02-08T15:00:00Z', 200, false);

-- Products
INSERT INTO products (name, price, original_price, image, rating, reviews, badge, category, sizes, description) VALUES
  ('Fantasy Royale Champion Tee', 34.99, NULL, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', 4.8, 234, 'BEST SELLER', 'T-Shirts', ARRAY['S','M','L','XL','XXL'], 'Premium cotton tee with embroidered crown logo. Show off your fantasy sports dominance.'),
  ('Crown Logo Snapback', 29.99, 39.99, 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400', 4.6, 156, 'LIMITED', 'Hats', NULL, 'Adjustable snapback with embroidered crown logo. One size fits most.'),
  ('Royale Hoodie', 59.99, NULL, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400', 4.9, 89, 'PREMIUM', 'Apparel', ARRAY['S','M','L','XL','XXL'], 'Ultra-soft fleece hoodie with gradient crown print. Perfect for game day.'),
  ('Victory Lap Tee', 29.99, NULL, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400', 4.5, 67, 'NEW', 'T-Shirts', ARRAY['S','M','L','XL'], 'Celebrate your wins with this premium graphic tee.'),
  ('Classic Dad Hat', 24.99, NULL, 'https://images.unsplash.com/photo-1575428652377-a2d80e2277fc?w=400', 4.7, 112, NULL, 'Hats', NULL, 'Relaxed fit dad hat with subtle crown embroidery.');

-- News
INSERT INTO news (source, headline) VALUES
  ('Fantasy Royale', 'Chiefs favored to win back-to-back Super Bowls as betting lines open'),
  ('Fantasy Royale', 'March Madness bracket predictions: Expert picks for the tournament'),
  ('Fantasy Royale', 'NBA Trade Deadline: Latest rumors and potential deals'),
  ('Fantasy Royale', 'Fantasy Football: Early rankings for next season released'),
  ('Fantasy Royale', 'Premier League title race heats up as top teams clash');

-- Videos
INSERT INTO videos (username, caption, likes, comments, shares, category, thumbnail, is_live) VALUES
  ('AustinEkeler', 'My Super Bowl prediction is LOCKED IN', 12400, 892, 234, 'Predictions', 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400', false),
  ('FantasyPro_Mike', 'Called it! 5-0 on my picks this week', 8932, 456, 189, 'Celebrations', 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400', false),
  ('BracketMaster', 'LIVE: Breaking down the tournament matchups', 3421, 1205, 87, 'Live', 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400', true),
  ('GridironGuru', 'Why the Eagles are my dark horse pick', 6789, 567, 145, 'Predictions', 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400', false);

-- Promo Slides
INSERT INTO promo_slides (type, title, subtitle, sponsor, sort_order) VALUES
  ('gradient', 'Super Bowl LVIII', 'Enter FREE - Win $50K', 'Fantasy Royale', 0),
  ('gradient', 'March Madness', 'Bracket Challenge Opens Soon', 'Fantasy Royale', 1),
  ('gradient', 'NBA All-Star Weekend', 'Pick Your Winners', 'Fantasy Royale', 2),
  ('gradient', 'Premier League', 'Weekly Picks Contest', 'Fantasy Royale', 3);

-- Ticker Items
INSERT INTO ticker_items (text, sort_order) VALUES
  ('KC Chiefs 24 - SF 49ers 21 (Q4)', 0),
  ('Lakers 108 - Celtics 105 (Final)', 1),
  ('Yankees 5 - Dodgers 3 (8th)', 2),
  ('Rangers 3 - Bruins 2 (OT)', 3),
  ('Warriors 95 - Heat 88 (Q3)', 4);

-- Avatar Parts
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
  ('acc_chain', 'Gold Chain', 'accessories', '', 350, 'epic', 'crowns', 350, NULL, NULL, false);

-- Room Items
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
  ('neon_sign', 'Neon Crown Sign', 'decor', '', 500, 'legendary', 'crowns', 500, NULL, NULL, NULL, 2, 1, 1, 'wall', false, NULL);

-- Room Categories
INSERT INTO room_categories (name, sort_order) VALUES
  ('furniture', 0), ('decor', 1), ('flooring', 2), ('wall', 3), ('trophy', 4), ('tech', 5);

-- Achievements
INSERT INTO achievements (id, name, description, icon, condition_type, condition_value, reward) VALUES
  ('first_win', 'First Victory', 'Win your first contest', 'trophy', 'wins', 1, 100),
  ('five_wins', 'Rising Star', 'Win 5 contests', 'star', 'wins', 5, 250),
  ('ten_wins', 'Champion', 'Win 10 contests', 'medal', 'wins', 10, 500),
  ('contest_10', 'Competitor', 'Enter 10 contests', 'flag', 'contests', 10, 150),
  ('streak_5', 'Hot Streak', 'Win 5 contests in a row', 'flame', 'streak', 5, 300),
  ('collector', 'Collector', 'Own 20 avatar parts', 'grid', 'avatar_parts', 20, 200),
  ('decorator', 'Decorator', 'Place 10 items in your room', 'home', 'room_items', 10, 200);
