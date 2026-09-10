-- Laboratory recognition details.
--
-- The labs table was built for a directory we did not yet have. Now that it is
-- filled from BIS's own published Group 1 and Group 2 lists, it needs the
-- fields those lists actually carry, and one the reader needs in order to
-- judge an entry:
--
--   osl_code   BIS's own identifier for the laboratory.
--   category   Private / Govt. / Autonomous, as published.
--   valid_to   When recognition lapses. Group 2 has no such date, and a lapsed
--              date is a fact worth showing rather than a row worth hiding.
--   operative  False when the newest dated event in Remarks is a suspension.
--   remarks    The raw audit trail, kept verbatim. It is free text and not
--              always in date order, so the derived flag above is best-effort
--              and the reader is given the original to check against.
--
-- Deliberately absent: any contact column. These lists publish no phone
-- numbers or addresses, and inventing plausible ones is exactly what this
-- ingest replaced.

alter table labs
    add column if not exists osl_code  text,
    add column if not exists category  text,
    add column if not exists valid_to  date,
    add column if not exists operative boolean not null default true,
    add column if not exists remarks   text;

-- The two filters the interface offers.
create index if not exists labs_operative_idx on labs (operative);
create index if not exists labs_city_idx      on labs (city);
