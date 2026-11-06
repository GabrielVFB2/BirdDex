/*
# Create the BirdDex post image bucket

1. Storage
- Create the `posts` bucket for bird observation images.
- Keep the bucket public because published observation images are intentionally visible to the whole BirdDex community.
- Limit uploads to 5 MB and common browser image formats.

2. Security
- Authenticated users can upload only inside their own user-id folder.
- Authenticated users can update or delete only files inside their own user-id folder.
- Public read access is intentional because published posts are community content.
- The policies apply to `storage.objects`; the bucket itself is configured for public image delivery.

3. Important notes
- The client must upload paths in the form `<authenticated-user-id>/<filename>`.
- Existing application rows are not changed.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts',
  'posts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "posts_public_read" ON storage.objects;
CREATE POLICY "posts_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "posts_insert_own_folder" ON storage.objects;
CREATE POLICY "posts_insert_own_folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "posts_update_own_folder" ON storage.objects;
CREATE POLICY "posts_update_own_folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "posts_delete_own_folder" ON storage.objects;
CREATE POLICY "posts_delete_own_folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
