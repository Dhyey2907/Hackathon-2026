# Supabase setup

This project uses Supabase Auth for the frontend and stores authenticated chat messages in the `chat_messages` table.

## 1. Create or open the Supabase project

1. Open [supabase.com/dashboard](https://supabase.com/dashboard).
2. Create a project, or select the project used by this application.
3. In **Project Settings > API**, copy:
   - **Project URL**
   - **Publishable key** (the anon key on older Supabase projects)

Do not put the service-role key in the frontend.

## 2. Enable email authentication

1. Open **Authentication > Providers > Email**.
2. Leave **Email** enabled.
3. Decide whether **Confirm email** should be enabled.

When email confirmation is enabled, signup shows a confirmation message and the user must click the email link before signing in. When it is disabled, signup signs the user in immediately.

For local development, add `http://localhost:3001` under **Authentication > URL Configuration > Redirect URLs** if confirmation emails are enabled.

## 3. Create the chat-history table

1. Open **SQL Editor** in the Supabase dashboard.
2. Create a new query.
3. Paste the complete contents of [`supabase/migrations/0002_chat_history.sql`](../supabase/migrations/0002_chat_history.sql).
4. Click **Run**.

The script creates `chat_messages`, its user/time index, enables Row Level Security, and allows each signed-in user to read and write only their own messages. It is safe to run again because the policies are replaced before being recreated.

The existing backend schema is separate. If the project is new, also run [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) for the BIS retrieval tables and RPC functions.

## 4. Configure the frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY

# Keep these enabled for the local mock chat, or point to the running API.
NEXT_PUBLIC_USE_MOCK=true
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart Next.js after changing environment variables:

```powershell
cd frontend
npx next dev -p 3001
```

## 5. Verify the full flow

1. Open `http://localhost:3001/signup`.
2. Create an account with an email and password of at least six characters.
3. If confirmation is enabled, confirm the email and then use `/login`.
4. Send a message from `/chat`.
5. In Supabase, open **Table Editor > chat_messages** and confirm two rows exist: one `user` row and one `assistant` row.
6. Sign out, sign back in, and confirm the previous messages load again.

If messages are not saved, check that the browser has a live Supabase session and that the `chat_messages` RLS policies were created. The frontend intentionally falls back to local auth and mock history when the two `NEXT_PUBLIC_SUPABASE_*` values are absent.