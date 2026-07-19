# Wolverines Setup

## 1. Create the Supabase project
Create a project at supabase.com, then copy `.env.local.example` to `.env.local`
and fill in your project's URL and anon key (Project Settings → API).

## 2. Apply the database schema
In the Supabase SQL Editor, run the contents of
`supabase/migrations/20260715000000_init.sql`. This creates all tables, enums,
the auto-profile trigger, and RLS policies.

## 3. Create the first admin account
1. In Supabase Studio → Authentication → Users, add a user manually (email + password).
2. In the SQL Editor, promote them to admin:
   ```sql
   update profiles set role = 'admin' where id = '<the new user''s UUID>';
   ```
3. Add their roster entry in the app once logged in, or insert one directly.

## 4. Deploy the invite-soldier edge function
This function uses the service-role key server-side to invite Soldier accounts
by email — it must never run in the browser.
```
supabase functions deploy invite-soldier
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your service role key>
```
(`SUPABASE_URL` and `SUPABASE_ANON_KEY` are already available to edge functions by default.)

## 5. Run the app
```
npm install
npm run dev
```
