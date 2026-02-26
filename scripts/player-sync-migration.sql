-- Fantasy Royale - Player Sync Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Creates tables for cross-device player data synchronization
-- Safe to run multiple times - uses CREATE TABLE IF NOT EXISTS and IF NOT EXISTS checks

-- ========================================
-- PART 1: CREATE TABLES FOR PLAYER SYNC
-- ========================================

-- 1. user_avatar_configs: Stores avatar configuration and owned items per user
-- Allows users to sync their avatar appearance and inventory across devices
CREATE TABLE IF NOT EXISTS user_avatar_configs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- avatar stores the current UserAvatar configuration (JSON object with keys: shoes, pants, shirt, jacket, accessories, hair, eyebrows, eyes, mouth, body)
  -- Each value is either a part ID string or null if that slot is empty
  avatar JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- owned_avatar_parts: array of avatar part IDs that the user owns
  owned_avatar_parts TEXT[] NOT NULL DEFAULT '{}'::text[],
  -- owned_room_items: array of room item IDs that the user owns
  owned_room_items TEXT[] NOT NULL DEFAULT '{}'::text[],
  -- contests_entered: array of contest IDs that the user has participated in
  contests_entered TEXT[] NOT NULL DEFAULT '{}'::text[],
  -- updated_at: timestamp of last modification
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. user_room_layouts: Stores room item placement configuration per user
-- Allows users to sync their room layout across devices
CREATE TABLE IF NOT EXISTS user_room_layouts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- placed_items stores an array of PlacedItem objects with structure: {id, itemId, x, y, rotation}
  -- Represents the spatial configuration of items in the user's room
  placed_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- updated_at: timestamp of last modification
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_user_avatar_configs_updated_at ON user_avatar_configs(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_room_layouts_updated_at ON user_room_layouts(updated_at);

-- ========================================
-- PART 3: CREATE TRIGGERS FOR AUTO-UPDATE
-- ========================================

-- Function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_avatar_configs table
DROP TRIGGER IF EXISTS update_user_avatar_configs_updated_at ON user_avatar_configs;
CREATE TRIGGER update_user_avatar_configs_updated_at
  BEFORE UPDATE ON user_avatar_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_room_layouts table
DROP TRIGGER IF EXISTS update_user_room_layouts_updated_at ON user_room_layouts;
CREATE TRIGGER update_user_room_layouts_updated_at
  BEFORE UPDATE ON user_room_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE user_avatar_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_room_layouts ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PART 5: ROW LEVEL SECURITY POLICIES
-- ========================================

-- ----------------------------------------
-- user_avatar_configs: Users access own data, service role has full access
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own user_avatar_configs') THEN
    CREATE POLICY "Users read own user_avatar_configs" ON user_avatar_configs
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own user_avatar_configs') THEN
    CREATE POLICY "Users insert own user_avatar_configs" ON user_avatar_configs
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own user_avatar_configs') THEN
    CREATE POLICY "Users update own user_avatar_configs" ON user_avatar_configs
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage user_avatar_configs') THEN
    CREATE POLICY "Service role manage user_avatar_configs" ON user_avatar_configs
      FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ----------------------------------------
-- user_room_layouts: Users access own data, service role has full access
-- ----------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own user_room_layouts') THEN
    CREATE POLICY "Users read own user_room_layouts" ON user_room_layouts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own user_room_layouts') THEN
    CREATE POLICY "Users insert own user_room_layouts" ON user_room_layouts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own user_room_layouts') THEN
    CREATE POLICY "Users update own user_room_layouts" ON user_room_layouts
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role manage user_room_layouts') THEN
    CREATE POLICY "Service role manage user_room_layouts" ON user_room_layouts
      FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ========================================
-- PART 6: STORAGE BUCKET FOR ADMIN ASSETS
-- ========================================

-- Note: Storage bucket policies cannot be created via SQL in Supabase.
-- You must configure the "assets" bucket and its policies through the Supabase Dashboard:
--
-- Steps to manually configure:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named "assets"
-- 3. Set the bucket to PUBLIC access
-- 4. Add these policies in the "Policies" tab:
--
--    a) Allow authenticated users to upload files:
--       - Policy name: "Allow authenticated users to upload"
--       - Allowed operation: INSERT
--       - Target roles: authenticated
--       - MIME type filter: (leave empty for all types)
--
--    b) Allow public read access:
--       - Policy name: "Allow public read access"
--       - Allowed operation: SELECT
--       - Target roles: public
--       - MIME type filter: (leave empty for all types)
--
--    c) Allow authenticated users to update/delete their uploads:
--       - Policy name: "Allow authenticated users to manage uploads"
--       - Allowed operation: UPDATE, DELETE
--       - Target roles: authenticated
--       - MIME type filter: (leave empty for all types)
--
-- Alternatively, use the Supabase CLI:
-- npx supabase storage buckets create assets --public
-- Then define policies as shown in the bucket policies configuration.

-- ========================================
-- END OF MIGRATION
-- ========================================
-- Summary:
-- - Created user_avatar_configs table for storing avatar state and owned items
-- - Created user_room_layouts table for storing room item placements
-- - Added auto-update triggers for both tables' updated_at columns
-- - Enabled RLS on both tables with user-scoped access policies
-- - Added service_role access for backend operations
-- - Documented manual storage bucket setup for admin asset uploads
--
-- All tables use IF NOT EXISTS for safe, idempotent execution.
