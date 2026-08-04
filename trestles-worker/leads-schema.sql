-- TJG Leads Table
-- Run this in Supabase: Database > SQL Editor > New query

create table if not exists leads (
  id                         uuid        primary key default gen_random_uuid(),
  first_name                 text        not null default '',
  last_name                  text        not null default '',
  email                      text        not null,
  phone                      text        not null default '',
  source                     text        not null default 'manual',
  status                     text        not null default 'active',
  property_key               text        not null default '',
  property_address           text        not null default '',
  message                    text        not null default '',
  saved_searches_count       integer     not null default 0,
  saved_properties_count     integer     not null default 0,
  saved_market_reports_count integer     not null default 0,
  created_at                 timestamptz not null default now(),
  last_activity              timestamptz not null default now()
);

-- Prevent duplicate emails (case-insensitive)
create unique index if not exists leads_email_idx on leads (lower(email));
