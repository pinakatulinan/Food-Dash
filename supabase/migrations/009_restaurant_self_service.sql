-- 009 — let restaurants run their own menu.
--
-- Until now every menu change was a SQL statement someone had to type by hand.
-- That does not survive a pilot: with a handful of restaurants changing prices
-- and selling out of things daily, it becomes a support ticket every time.
--
-- Two things were missing:
--   1. Restaurants could not update their OWN row at all (see below).
--   2. There was nowhere to put a photo.

-- ============ FIXES A LIVE BUG ============
-- RLS is enabled on restaurants but the only policy is "public read
-- restaurants" for SELECT. There is no UPDATE policy, so the open/closed
-- toggle in the dashboard has never actually worked — the update matches zero
-- rows, Postgres reports no error for that, and the UI updates its own state
-- optimistically. It looks fine until you reload and the restaurant is closed
-- again.
drop policy if exists "owner updates own restaurant" on restaurants;
create policy "owner updates own restaurant" on restaurants for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---- Column privileges ----
-- Same reasoning as the profiles and riders grants in schema.sql: RLS picks
-- the ROWS, these pick the COLUMNS. Without this, the policy above would let a
-- restaurant set its own commission_rate to zero, or rename itself to another
-- business. Both are commercial terms you agreed, not settings.
--
-- What they may change: whether they're accepting orders, their banner photo,
-- their blurb, and how long they say food takes to cook.
revoke update on restaurants from anon, authenticated;
grant update (is_open, image_url, description, prep_minutes)
  on restaurants to authenticated;

-- menu_items needs no new policy: "owner manages menu" in schema.sql is FOR
-- ALL, and a FOR ALL policy with no WITH CHECK reuses its USING clause for
-- inserts and updates. A restaurant therefore cannot move a dish onto someone
-- else's menu — the new restaurant_id has to pass the same ownership test.

-- ============ PHOTO STORAGE ============
-- A public bucket, so the customer app can render an <Image> straight from the
-- URL with no signed-URL round trip on every menu row. Nothing secret goes in
-- here — these are pictures of food meant to be seen by everyone.
--
-- Limits are enforced by the bucket rather than trusted to the upload form: a
-- browser can be told to send anything.
--
-- IF UPLOADS FAIL WITH "Bucket not found": this insert did not take. Whether
-- the SQL editor may write to storage.buckets varies by project. Create it by
-- hand instead — Storage → New bucket:
--     Name:              menu-images
--     Public bucket:     ON        (customers must be able to see the photos)
--     File size limit:   5 MB
--     Allowed MIME types: image/jpeg, image/png, image/webp
-- then re-run this file; the insert below no-ops and you still get the
-- policies, which are the part that actually matters for security.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,                                        -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Files are stored as <restaurant_id>/<filename>, and the first path segment
-- is what these policies check. A restaurant can only ever write inside its
-- own folder, so one restaurant can't overwrite another's photos.
drop policy if exists "owner uploads menu images" on storage.objects;
create policy "owner uploads menu images" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] in (
      select id::text from restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "owner replaces menu images" on storage.objects;
create policy "owner replaces menu images" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] in (
      select id::text from restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "owner deletes menu images" on storage.objects;
create policy "owner deletes menu images" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] in (
      select id::text from restaurants where owner_id = auth.uid()
    )
  );


-- ============ VERIFY ============
-- Every row should read PASS.
select 'restaurants update policy exists' as check,
       case when exists (
         select 1 from pg_policies
          where tablename = 'restaurants' and policyname = 'owner updates own restaurant'
       ) then 'PASS' else 'FAIL' end as result
union all
select 'restaurant columns are restricted',
       case when not exists (
         select 1 from information_schema.column_privileges
          where table_name = 'restaurants' and privilege_type = 'UPDATE'
            and grantee = 'authenticated' and column_name = 'commission_rate'
       ) then 'PASS' else 'FAIL — commission_rate is still writable' end
union all
select 'menu-images bucket exists',
       case when exists (select 1 from storage.buckets where id = 'menu-images')
            then 'PASS' else 'FAIL' end
union all
select 'upload policy exists',
       case when exists (
         select 1 from pg_policies
          where tablename = 'objects' and policyname = 'owner uploads menu images'
       ) then 'PASS' else 'FAIL' end;
