-- BIS assistant schema: catalogue + retrievable chunks + hybrid search.
--
-- Dense vectors are 1536-dim, not gemini-embedding-001's native 3072: pgvector
-- HNSW indexes cap at 2000 dimensions, so the embedder requests Matryoshka
-- truncation to 1536. Without that the index cannot be built at all.
--
-- The lexical arm uses Postgres full-text search rather than a sparse vector
-- type. tsvector with the 'simple' configuration keeps exact tokens such as
-- "15111", "huid" and "crs" matchable, and 'simple' is deliberate: stemming
-- dictionaries would mangle standard numbers, and Postgres ships no Hindi
-- dictionary anyway.

create extension if not exists vector;

-- ---------------------------------------------------------------- standards

create table if not exists standards (
    is_number         text primary key,
    title             text not null,
    scope             text,
    ics_code          text,
    division          text,
    committee         text,
    year              int,
    status            text,
    under_qco         boolean default false,
    source_url        text,
    title_hindi       text,
    -- An array, not a single value: a sectional committee legitimately serves
    -- several product groups (MED 33 Utensils covers both household appliances
    -- and pressure cookers; CED 22 Fire Fighting owns extinguishers and
    -- helmets). A scalar column silently gave each shared committee to whichever
    -- group was declared first, leaving cookers_utensils with zero rows.
    group_keys        text[] default '{}',
    embedding         vector(1536),
    fts               tsvector generated always as (
                          to_tsvector('simple',
                              coalesce(is_number, '') || ' ' ||
                              coalesce(title, '') || ' ' ||
                              coalesce(committee, ''))
                      ) stored,
    scraped_at        timestamptz default now()
);

create index if not exists standards_fts_idx      on standards using gin (fts);
create index if not exists standards_committee_idx on standards (committee);
create index if not exists standards_group_keys_idx on standards using gin (group_keys);

-- ------------------------------------------------------------------- chunks

create table if not exists chunks (
    chunk_uid     text primary key,
    text          text not null,
    doc_key       text not null,
    doc_title     text,
    doc_type      text not null,
    source_url    text,
    ordinal       int default 0,
    token_count   int default 0,
    clause        text,
    section_path  text,
    page          int,
    is_number     text,
    language      text default 'en',
    embedding     vector(1536),
    fts           tsvector generated always as (
                      to_tsvector('simple', coalesce(text, ''))
                  ) stored,
    created_at    timestamptz default now()
);

create index if not exists chunks_fts_idx       on chunks using gin (fts);
create index if not exists chunks_doc_type_idx  on chunks (doc_type);
create index if not exists chunks_is_number_idx on chunks (is_number);

-- -------------------------------------------------------------------- labs

create table if not exists labs (
    id         bigserial primary key,
    name       text not null,
    city       text,
    state      text,
    scope      text,
    schemes    text,
    contact    text,
    source_url text
);

create index if not exists labs_state_idx on labs (state);


-- ---------------------------------------------------- lexical query builder
--
-- plainto_tsquery ANDs every term, so "gold hallmarking jewellery" matched
-- nothing: no single title contains all three words. The lexical arm exists for
-- recall - RRF and the reranker supply precision - so terms are ORed instead.
--
-- Stopwords are then stripped from the QUERY only. The 'simple' config removes
-- none, deliberately, so that standard numbers and tokens like "huid" survive
-- indexing; but ORing "which standard applies to LED bulbs" would otherwise
-- match nearly every row through "standard"/"applies"/"to" and bury the real
-- hits. Terms under 3 characters are dropped unless they are pure digits, which
-- are usually part of a standard number.
create or replace function bis_or_tsquery(input text)
returns tsquery
language sql immutable
as $$
    select coalesce(
        nullif(
            array_to_string(
                array(
                    select quote_literal(lex)
                    from unnest(
                        tsvector_to_array(to_tsvector('simple', coalesce(input, '')))
                    ) lex
                    where lex not in (
                        'a','an','and','are','as','at','be','by','can','do','does',
                        'for','from','get','has','have','how','i','in','is','it','me',
                        'my','need','of','on','or','our','required','requirement',
                        'requirements','should','specification','standard','standards',
                        'that','the','their','they','this','to','use','used','using',
                        'want','was','what','when','where','which','who','will','with',
                        'would','you','your','applies','apply','applicable','about',
                        'please','tell','give','list','india','indian','bis'
                    )
                      and (length(lex) >= 3 or lex ~ '^[0-9]+$')
                ),
                ' | '
            ),
            ''
        )::tsquery,
        'zzzz_no_match_zzzz'::tsquery
    );
$$;

-- ------------------------------------------------------- hybrid search RPCs
--
-- Dense and lexical results are fused with Reciprocal Rank Fusion rather than
-- a weighted sum of scores: cosine distance and ts_rank_cd are on completely
-- different scales, so any weighting would be arbitrary. RRF only needs the
-- rank ordering from each arm.

create or replace function match_chunks(
    query_embedding  vector(1536),
    query_text       text,
    match_limit      int  default 30,
    rrf_k            int  default 60,
    filter_doc_type  text default null
)
returns table (
    chunk_uid    text,
    text         text,
    doc_title    text,
    doc_type     text,
    source_url   text,
    clause       text,
    page         int,
    is_number    text,
    score        double precision
)
language sql stable
as $$
    with q as (
        select bis_or_tsquery(query_text) as tsq
    ),
    dense as (
        select c.chunk_uid,
               row_number() over (order by c.embedding <=> query_embedding) as rank
        from chunks c
        where c.embedding is not null
          and (filter_doc_type is null or c.doc_type = filter_doc_type)
        order by c.embedding <=> query_embedding
        limit match_limit * 2
    ),
    lexical as (
        select c.chunk_uid,
               row_number() over (
                   order by ts_rank_cd(c.fts, q.tsq) desc
               ) as rank
        from chunks c, q
        where c.fts @@ q.tsq
          and (filter_doc_type is null or c.doc_type = filter_doc_type)
        order by ts_rank_cd(c.fts, q.tsq) desc
        limit match_limit * 2
    ),
    fused as (
        select coalesce(d.chunk_uid, l.chunk_uid) as chunk_uid,
               coalesce(1.0 / (rrf_k + d.rank), 0)
             + coalesce(1.0 / (rrf_k + l.rank), 0) as score
        from dense d
        full outer join lexical l on d.chunk_uid = l.chunk_uid
    )
    select c.chunk_uid, c.text, c.doc_title, c.doc_type, c.source_url,
           c.clause, c.page, c.is_number, f.score
    from fused f
    join chunks c on c.chunk_uid = f.chunk_uid
    order by f.score desc
    limit match_limit;
$$;


-- Standards are searched separately from chunks: "which standard applies to my
-- product" ranks over catalogue titles, which is a different retrieval problem
-- from finding a passage of scheme text.
create or replace function match_standards(
    query_embedding  vector(1536),
    query_text       text,
    match_limit      int  default 20,
    rrf_k            int  default 60,
    filter_group     text default null
)
returns table (
    is_number   text,
    title       text,
    committee   text,
    division    text,
    year        int,
    source_url  text,
    group_keys  text[],
    score       double precision
)
language sql stable
as $$
    with q as (
        select bis_or_tsquery(query_text) as tsq
    ),
    dense as (
        select s.is_number,
               row_number() over (order by s.embedding <=> query_embedding) as rank
        from standards s
        where s.embedding is not null
          and (filter_group is null or filter_group = any(s.group_keys))
        order by s.embedding <=> query_embedding
        limit match_limit * 2
    ),
    lexical as (
        select s.is_number,
               row_number() over (order by ts_rank_cd(s.fts, q.tsq) desc) as rank
        from standards s, q
        where s.fts @@ q.tsq
          and (filter_group is null or filter_group = any(s.group_keys))
        order by ts_rank_cd(s.fts, q.tsq) desc
        limit match_limit * 2
    ),
    fused as (
        select coalesce(d.is_number, l.is_number) as is_number,
               coalesce(1.0 / (rrf_k + d.rank), 0)
             + coalesce(1.0 / (rrf_k + l.rank), 0) as score
        from dense d
        full outer join lexical l on d.is_number = l.is_number
    )
    select s.is_number, s.title, s.committee, s.division, s.year,
           s.source_url, s.group_keys, f.score
    from fused f
    join standards s on s.is_number = f.is_number
    order by f.score desc
    limit match_limit;
$$;


-- ------------------------------------------------------------------ access
-- All of this is public BIS information, so anonymous read is fine. Writes are
-- restricted to the service role, which is what the ingestion script uses.

alter table standards enable row level security;
alter table chunks    enable row level security;
alter table labs      enable row level security;

drop policy if exists standards_public_read on standards;
drop policy if exists chunks_public_read    on chunks;
drop policy if exists labs_public_read      on labs;

create policy standards_public_read on standards for select to anon, authenticated using (true);
create policy chunks_public_read    on chunks    for select to anon, authenticated using (true);
create policy labs_public_read      on labs      for select to anon, authenticated using (true);
