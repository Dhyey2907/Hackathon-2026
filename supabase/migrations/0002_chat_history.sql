create table if not exists chat_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    sources jsonb default '[]'::jsonb,
    session_id text,
    created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created_at_idx
    on chat_messages (user_id, created_at desc);

alter table chat_messages enable row level security;

drop policy if exists "Users can view own chat history" on chat_messages;
create policy "Users can view own chat history"
    on chat_messages for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own chat history" on chat_messages;
create policy "Users can insert own chat history"
    on chat_messages for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own chat history" on chat_messages;
create policy "Users can update own chat history"
    on chat_messages for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete own chat history" on chat_messages;
create policy "Users can delete own chat history"
    on chat_messages for delete
    using (auth.uid() = user_id);
