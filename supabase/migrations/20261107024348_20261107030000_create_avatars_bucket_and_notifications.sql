/*
# Add avatars storage bucket and notification tracking table

1. Storage
- Create the `avatars` bucket for profile pictures.
- Keep the bucket public so avatars can be displayed across the app.
- Limit uploads to 2 MB and common browser image formats.
- Authenticated users can upload, update, and delete only inside their own user-id folder.

2. New tables
- `notifications`
  - `id`: unique notification identifier.
  - `user_id`: authenticated profile that receives the notification (the owner).
  - `actor_id`: profile that triggered the notification (the person who liked/commented/followed/messaged).
  - `type`: one of `like`, `comment`, `follow`, `message`.
  - `post_id`: optional reference to the related publication.
  - `read`: whether the notification has been seen.
  - `created_at`: notification creation time.

3. Security
- Enable row-level security on `notifications`.
- Notifications are readable and markable as read only by their owner.
- Notifications can only be created by the actor (the authenticated user performing the action).
- A notification cannot be deleted by the user; that is reserved for server-side moderation if ever needed.
- Grant only SELECT, INSERT, UPDATE to authenticated users.
- Narrow profile updates to the columns users may actually edit (display_name, bio, location, avatar_url). Revoke table-wide UPDATE and grant only those columns, so users cannot change id, username, or created_at through the data API.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_insert_own_folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_update_own_folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_delete_own_folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'message')),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_user_actor_different CHECK (user_id <> actor_id),
  CONSTRAINT notifications_message_no_post CHECK (type <> 'message' OR post_id IS NULL)
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_as_actor" ON public.notifications;
CREATE POLICY "notifications_insert_as_actor"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid() AND user_id <> auth.uid());

DROP POLICY IF EXISTS "notifications_mark_own_read" ON public.notifications;
CREATE POLICY "notifications_mark_own_read"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, bio, location, avatar_url) ON public.profiles TO authenticated;
