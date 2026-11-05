/*
# Pio — Bird-watching community schema

Creates the full data model for a bird-watching social community app:
- `profiles` — public user profile data (display name, bio, location, avatar)
- `posts` — bird sighting posts with caption and location
- `comments` — comments on posts
- `likes` — likes on posts (one per user per post)
- `follows` — follow relationships between users

## Tables

1. `profiles`
   - `id` (uuid, PK, references auth.users)
   - `username` (text, unique) — handle like @anaobserva
   - `display_name` (text) — full display name
   - `bio` (text) — short biography
   - `location` (text) — user location string
   - `avatar_url` (text) — optional avatar image URL
   - `created_at` (timestamptz)

2. `posts`
   - `id` (uuid, PK)
   - `user_id` (uuid, FK -> profiles.id, defaults to auth.uid())
   - `image_url` (text) — photo of the bird
   - `caption` (text) — what the user observed
   - `location` (text, optional) — where the sighting happened
   - `species_name` (text, optional) — common name of the bird
   - `species_scientific` (text, optional) — scientific name
   - `created_at` (timestamptz)

3. `comments`
   - `id` (uuid, PK)
   - `post_id` (uuid, FK -> posts.id, ON DELETE CASCADE)
   - `user_id` (uuid, FK -> profiles.id, defaults to auth.uid())
   - `content` (text)
   - `created_at` (timestamptz)

4. `likes`
   - `id` (uuid, PK)
   - `post_id` (uuid, FK -> posts.id, ON DELETE CASCADE)
   - `user_id` (uuid, FK -> profiles.id, defaults to auth.uid())
   - `created_at` (timestamptz)
   - UNIQUE(post_id, user_id) — one like per user per post

5. `follows`
   - `id` (uuid, PK)
   - `follower_id` (uuid, FK -> profiles.id, defaults to auth.uid())
   - `following_id` (uuid, FK -> profiles.id)
   - `created_at` (timestamptz)
   - UNIQUE(follower_id, following_id) — one follow per pair

## Security
- RLS enabled on all tables.
- Profiles: anyone authenticated can read; users can only update their own.
- Posts: anyone authenticated can read; users can only insert/update/delete their own.
- Comments: anyone authenticated can read; users can only insert/delete their own.
- Likes: anyone authenticated can read; users can only insert/delete their own.
- Follows: anyone authenticated can read; users can only insert/delete their own follows.
- All owner columns default to auth.uid() so inserts work without explicitly passing the owner.
- Grants are scoped to `authenticated` only (this app requires sign-in).
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  location text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE, INSERT ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  location text DEFAULT '',
  species_name text DEFAULT '',
  species_scientific text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO authenticated;

DROP POLICY IF EXISTS "posts_select_all" ON posts;
CREATE POLICY "posts_select_all" ON posts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_update_own" ON posts;
CREATE POLICY "posts_update_own" ON posts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own" ON posts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON comments TO authenticated;

DROP POLICY IF EXISTS "comments_select_all" ON comments;
CREATE POLICY "comments_select_all" ON comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON comments;
CREATE POLICY "comments_delete_own" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON likes TO authenticated;

DROP POLICY IF EXISTS "likes_select_all" ON likes;
CREATE POLICY "likes_select_all" ON likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own" ON likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_own" ON likes;
CREATE POLICY "likes_delete_own" ON likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Follows
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON follows TO authenticated;

DROP POLICY IF EXISTS "follows_select_all" ON follows;
CREATE POLICY "follows_select_all" ON follows FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own" ON follows FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own" ON follows FOR DELETE
  TO authenticated USING (auth.uid() = follower_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
