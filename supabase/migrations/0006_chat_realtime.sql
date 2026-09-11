-- Live chat history.
--
-- The sidebar's Recents list and the open conversation update as messages are
-- written - from this tab, another tab, or another device. Supabase Realtime
-- streams inserts from tables in the supabase_realtime publication, and checks
-- each subscriber against the table's row-level security, so a user only ever
-- receives their own messages (chat_messages_select_own).

do $$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
    ) then
        alter publication supabase_realtime add table public.chat_messages;
    end if;
end $$;
