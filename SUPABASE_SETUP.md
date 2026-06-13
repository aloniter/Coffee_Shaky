# Connect Coffee Shaky to the new Supabase project

1. In the new Supabase dashboard, open **SQL Editor** and create a new query.
2. Paste and run all of `supabase-setup.sql`.
3. Open **Project Settings > API Keys**.
4. Copy the **Publishable key** (`sb_publishable_...`). A legacy **anon key** also works.
5. Set that key and the project URL in `supabase-config.js`.
6. Reload the app and submit a test order. It should appear immediately in every open browser.

The configured project reference is `ajreqirindyaejgspzry`.

## Important security note

This app has no sign-in or staff authorization. To preserve its existing behavior, the SQL policies allow any visitor to read, create, update, and delete orders. Do not put a Supabase secret key or legacy `service_role` key in this browser app.
