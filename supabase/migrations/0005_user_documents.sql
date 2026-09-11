-- The document vault: licences, certificates, test reports.
--
-- Until now uploads lived only in the browser (IndexedDB), so they were lost
-- with the browser's site data and never followed the user to another device.
-- Files now go to a private Storage bucket, one folder per user, with their
-- details in user_documents.
--
-- Like chat_messages this is private data, so every policy is owner-scoped.
-- The browser uploads with the signed-in user's own JWT: no service key is
-- involved, and auth.uid() comes from that token, so a client cannot read or
-- write another user's folder by sending a different id.

create table if not exists user_documents (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name          text not null check (char_length(name) between 1 and 255),
    file_type     text not null,
    mime_type     text not null,
    size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
    category      text not null check (category in ('License', 'Test Report', 'Certificate', 'Other')),
    expiry_date   date,
    storage_path  text not null unique,
    uploaded_at   timestamptz not null default now(),
    -- A row may only point into its owner's folder, so it cannot be used to
    -- reach someone else's file even if that file's path were known.
    constraint user_documents_path_in_owner_folder
        check (split_part(storage_path, '/', 1) = user_id::text)
);

create index if not exists user_documents_user_time_idx
    on user_documents (user_id, uploaded_at desc);

alter table user_documents enable row level security;

drop policy if exists user_documents_select_own on user_documents;
drop policy if exists user_documents_insert_own on user_documents;
drop policy if exists user_documents_update_own on user_documents;
drop policy if exists user_documents_delete_own on user_documents;

create policy user_documents_select_own on user_documents
    for select to authenticated using ((select auth.uid()) = user_id);

create policy user_documents_insert_own on user_documents
    for insert to authenticated with check ((select auth.uid()) = user_id);

create policy user_documents_update_own on user_documents
    for update to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy user_documents_delete_own on user_documents
    for delete to authenticated using ((select auth.uid()) = user_id);

-- Private bucket: nothing is reachable by URL alone. The app reads files with
-- the user's session, or through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'user-documents',
    'user-documents',
    false,
    20971520,
    array[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'text/csv'
    ]
)
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists user_documents_objects_select_own on storage.objects;
drop policy if exists user_documents_objects_insert_own on storage.objects;
drop policy if exists user_documents_objects_delete_own on storage.objects;

-- Objects are stored as <user id>/<document id>/<file name>; the first path
-- segment must be the caller's own id.
create policy user_documents_objects_select_own on storage.objects
    for select to authenticated
    using (bucket_id = 'user-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy user_documents_objects_insert_own on storage.objects
    for insert to authenticated
    with check (bucket_id = 'user-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy user_documents_objects_delete_own on storage.objects
    for delete to authenticated
    using (bucket_id = 'user-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
