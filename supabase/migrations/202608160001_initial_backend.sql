create extension if not exists pgcrypto;

create type public.generation_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.generation_stage as enum (
  'queued',
  'analyzing_repository',
  'generating_content',
  'rendering_portfolio',
  'rendering_resume',
  'completed',
  'failed'
);
create type public.deletion_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  github_user_id bigint not null unique,
  username text not null,
  display_name text not null,
  email text,
  avatar_url text not null,
  profile_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index sessions_active_user_id_idx on public.sessions(user_id, expires_at)
  where revoked_at is null;

create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider_user_id bigint not null unique,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  token_expires_at timestamptz,
  scopes text[] not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  github_repository_id bigint not null,
  owner_username text not null,
  owner_avatar_url text not null,
  name text not null,
  full_name text not null,
  description text,
  html_url text not null,
  default_branch text not null,
  primary_language text,
  visibility text not null check (visibility in ('public', 'private')),
  star_count integer not null default 0 check (star_count >= 0),
  fork_count integer not null default 0 check (fork_count >= 0),
  pushed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, github_repository_id)
);

create index repositories_user_updated_at_idx on public.repositories(user_id, pushed_at desc);

create table public.repository_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete cascade,
  source_pushed_at timestamptz not null,
  language_breakdown jsonb not null default '[]'::jsonb,
  commit_count integer not null default 0 check (commit_count >= 0),
  pull_request_count integer not null default 0 check (pull_request_count >= 0),
  summary text not null,
  created_at timestamptz not null default now()
);

create index repository_analyses_repository_created_at_idx
  on public.repository_analyses(repository_id, created_at desc);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete restrict,
  repository_analysis_id uuid references public.repository_analyses(id) on delete set null,
  workflow_instance_id text unique,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 2000),
  target_role text check (target_role is null or char_length(target_role) <= 100),
  tone text check (tone is null or tone in ('professional', 'concise', 'storytelling')),
  highlights jsonb not null default '[]'::jsonb,
  status public.generation_status not null default 'queued',
  stage public.generation_stage not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  message text not null,
  error_code text,
  error_message text,
  portfolio_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index generation_jobs_one_active_per_user_idx
  on public.generation_jobs(user_id)
  where status in ('queued', 'processing');

create index generation_jobs_user_created_at_idx on public.generation_jobs(user_id, created_at desc);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete restrict,
  generation_job_id uuid not null unique references public.generation_jobs(id) on delete restrict,
  title text not null,
  target_role text not null,
  content jsonb not null,
  style text not null default 'default' check (style = 'default'),
  resume_pdf_path text,
  resume_pdf_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (resume_pdf_path is null and resume_pdf_generated_at is null)
    or (resume_pdf_path is not null and resume_pdf_generated_at is not null)
  )
);

alter table public.generation_jobs
  add constraint generation_jobs_portfolio_id_fkey
  foreign key (portfolio_id) references public.portfolios(id) on delete set null;

create table public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workflow_instance_id text unique,
  status public.deletion_status not null default 'queued',
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index account_deletion_jobs_one_active_per_user_idx
  on public.account_deletion_jobs(user_id)
  where status in ('queued', 'processing');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger github_connections_set_updated_at
before update on public.github_connections
for each row execute function public.set_updated_at();

create trigger repositories_set_updated_at
before update on public.repositories
for each row execute function public.set_updated_at();

create trigger generation_jobs_set_updated_at
before update on public.generation_jobs
for each row execute function public.set_updated_at();

create trigger portfolios_set_updated_at
before update on public.portfolios
for each row execute function public.set_updated_at();

create trigger account_deletion_jobs_set_updated_at
before update on public.account_deletion_jobs
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.github_connections enable row level security;
alter table public.repositories enable row level security;
alter table public.repository_analyses enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.portfolios enable row level security;
alter table public.account_deletion_jobs enable row level security;
