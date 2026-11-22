-- Landing page content is independent from Plot List and plot inventory.
create table if not exists public.layout_landing_pages (
  slug text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.layout_landing_pages enable row level security;
-- The Netlify serverless API accesses this table with the server-side service-role key.
