-- BIS announcements, from the Bureau's own What's New feed.
--
-- Replaces a page of four hand-written amendments with invented IS numbers.
-- Every row here is something BIS published, carrying the date BIS put on it
-- and a link back to the notice.
--
--   update_uid   blake2b of title + link. Stable across re-fetches, so a
--                re-run updates rows rather than duplicating them. Keyed on
--                content and not on position, because BIS reorders the feed
--                as it publishes and a position key would rewrite every row.
--   category     derived from the title - amendment, qco, hallmarking,
--                licence, standard, recruitment, event, news. A convenience
--                for filtering, not something BIS itself publishes.
--   published_on the date on the notice. Nullable: a handful of archive rows
--                carry no date, and guessing one would be worse than a gap.
--   is_number    lifted from the title when present, so a reader can find
--                every notice mentioning IS 1867.

create table if not exists bis_updates (
    id           bigserial primary key,
    update_uid   text not null unique,
    title        text not null,
    url          text,
    category     text not null default 'news',
    media_type   text,
    size         text,
    published_on date,
    is_number    text,
    source_page  text
);

-- Newest first is the only ordering the interface uses; the rest support the
-- category chips and the "notices about IS 1867" lookup.
create index if not exists bis_updates_published_idx on bis_updates (published_on desc);
create index if not exists bis_updates_category_idx  on bis_updates (category);
create index if not exists bis_updates_is_number_idx on bis_updates (is_number);

alter table bis_updates enable row level security;

-- Public BIS announcements: anyone may read, nobody may write without the
-- service key.
drop policy if exists bis_updates_public_read on bis_updates;
create policy bis_updates_public_read on bis_updates
    for select to anon, authenticated using (true);
