# Supabase database setup

This repository contains the initial schema migration in
[`migrations/20261014133000_initial_schema.sql`](./migrations/20261014133000_initial_schema.sql).
It has not been run against a Supabase project by this change.

## Apply the migration

1. Create a Supabase project and wait until its database and Storage service are ready.
2. In the Supabase Dashboard, open **SQL Editor**, create a query, paste the contents of the migration file, and run it once. The executing account must be a trusted project operator.
3. Confirm that the three tables, the `property-images` bucket, and their policies exist before connecting the website.

The file is a one-time initial migration. For CLI-based migration tracking, initialize/configure the Supabase CLI for the repository, link it to the project, and run `supabase db push`; do not also apply the same migration manually.

## Provision the first administrator

1. Create the broker's user in **Authentication → Users** in the Dashboard. Do not enable open user registration for the admin panel.
2. Copy that account's UUID and, as the trusted project operator, run the following in SQL Editor, replacing the placeholder with the verified UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict (user_id) do nothing;
   ```

Ordinary application roles have no grants or RLS policies on `admin_users`; only a trusted database operator can provision administrators. Never put a service-role key in the website.

## Administrative sign-in

The static administrative entry point is `/admin/`. It uses the existing browser Supabase client and Supabase Auth email/password sign-in; public user registration must remain disabled. After login, the page calls `public.is_admin()` to check the authenticated user's authorization without querying `admin_users` directly. The function returns only whether the current caller is an administrator.

The browser check controls access to the administrative interface, but it is not the database security boundary. Keep the RLS policies enabled: database and Storage operations must remain protected by the policies that call `public.is_admin()`. A static page can be downloaded by anyone, so do not place private data or privileged credentials in its HTML or JavaScript. The Supabase publishable key is the only key allowed in the browser.

## Image management and deletion

The `property-images` bucket is private. Public pages can read only images belonging to published properties; administrators can upload, replace, read, and remove images belonging to existing properties. Store image objects under `<property UUID>/<filename>`. The Storage policies require one folder level containing an existing property's UUID for uploads and updates. Admins can also delete correctly shaped orphaned objects if a property or metadata insert was removed after an interrupted workflow. Because the bucket is private, the site must request short-lived signed URLs (or authenticated downloads) rather than use public URLs; signed URLs are bearer links and remain usable until they expire.

When deleting a photo or property, use the Storage API as the authorized admin to remove the associated object paths first. After successful object removal, delete the matching `property_images` rows and then, if needed, the property. The foreign key intentionally blocks deleting a property while image metadata remains. Storage files are not deleted by Postgres cascades. If an upload succeeds but its metadata insert fails, clean up that orphaned object through the Storage API before deleting the property where possible.

To change the cover, update one chosen image's `is_cover` to `true`; a database trigger clears the previous cover in the same transaction. Image metadata writes are serialized by a transaction-scoped advisory lock so simultaneous cover changes cannot race or deadlock around the unique index. To order a gallery, assign `sort_order` values and query by `sort_order`, then `created_at`, then `id` for deterministic ties.

The admin panel manages a property's photos from its entry in the property list. It uploads each object before inserting its `property_images` metadata, cleans up the object if that insert fails, and removes objects before their metadata rows. The migration's Storage delete policy is named `property_images_storage_admin_delete` and is restricted to authenticated administrators and UUID-shaped first-level folders.
