/*
# Add private conversations and saved publications

1. New tables
- `messages`
  - `id`: unique message identifier.
  - `sender_id`: authenticated profile that sent the message.
  - `recipient_id`: authenticated profile that receives the message.
  - `content`: text of the message.
  - `created_at`: message creation time.
- `bookmarks`
  - `id`: unique saved-publication identifier.
  - `user_id`: authenticated profile that saved the publication.
  - `post_id`: publication that was saved.
  - `created_at`: save time.

2. Security
- Enable row-level security on both tables.
- Messages are readable only by their sender or recipient.
- Messages can only be created by the authenticated sender and can only be changed or removed by that sender.
- Bookmarks are readable and writable only by their owner.
- Add a unique constraint so a user can save a publication only once.
- Grant only the CRUD operations used by the application to authenticated users.

3. Important notes
- Both ownership columns default to `auth.uid()` so the browser does not need to provide a trusted owner value.
- Public profiles and posts remain unchanged; only private message history and personal saved items are protected.
*/

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_sender_recipient_different CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS messages_sender_recipient_created_idx
  ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_sender_created_idx
  ON public.messages (recipient_id, sender_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
ON public.messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "messages_insert_as_sender" ON public.messages;
CREATE POLICY "messages_insert_as_sender"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_update_as_sender" ON public.messages;
CREATE POLICY "messages_update_as_sender"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_as_sender" ON public.messages;
CREATE POLICY "messages_delete_as_sender"
ON public.messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookmarks_user_post_unique UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS bookmarks_user_created_idx
  ON public.bookmarks (user_id, created_at DESC);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;

DROP POLICY IF EXISTS "bookmarks_select_own" ON public.bookmarks;
CREATE POLICY "bookmarks_select_own"
ON public.bookmarks FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_insert_own" ON public.bookmarks;
CREATE POLICY "bookmarks_insert_own"
ON public.bookmarks FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_update_own" ON public.bookmarks;
CREATE POLICY "bookmarks_update_own"
ON public.bookmarks FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_delete_own" ON public.bookmarks;
CREATE POLICY "bookmarks_delete_own"
ON public.bookmarks FOR DELETE
TO authenticated
USING (user_id = auth.uid());
