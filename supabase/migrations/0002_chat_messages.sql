-- Chat history for the frontend.
--
-- The UI writes here on every turn, but the table did not exist, so every
-- insert failed and history silently never persisted. The frontend logs the
-- error and carries on, which is the right behaviour but makes the problem
-- invisible from the screen.
--
-- Unlike standards, chunks and labs, this is private data. Those hold public
-- BIS information and are world-readable; a person's questions are not, so
-- these policies are owner-scoped instead.

create table if not exists chat_messages (
    id          bigserial primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,
    session_id  text,
    role        text not null check (role in ('user', 'assistant')),
    content     text not null,
    sources     jsonb not null default '[]'::jsonb,
    created_at  timestamptz not null default now()
);

-- Matches how the frontend reads: filter by user, order by time.
create index if not exists chat_messages_user_time_idx
    on chat_messages (user_id, created_at);
create index if not exists chat_messages_session_idx
    on chat_messages (session_id);

alter table chat_messages enable row level security;

drop policy if exists chat_messages_select_own on chat_messages;
drop policy if exists chat_messages_insert_own on chat_messages;
drop policy if exists chat_messages_delete_own on chat_messages;

-- auth.uid() comes from the request's JWT, so a client cannot claim to be
-- someone else by sending a different user_id - the WITH CHECK rejects it.
-- Verified: an anonymous client reading this table gets an empty set, and an
-- anonymous insert is refused with 42501.
create policy chat_messages_select_own on chat_messages
    for select to authenticated using (auth.uid() = user_id);

create policy chat_messages_insert_own on chat_messages
    for insert to authenticated with check (auth.uid() = user_id);

create policy chat_messages_delete_own on chat_messages
    for delete to authenticated using (auth.uid() = user_id);
