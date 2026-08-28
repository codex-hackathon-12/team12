-- 생성 작업과 포트폴리오가 저장소를 여러 개 참조할 수 있게 한다.
-- 기존 repository_id 컬럼은 대표(첫 번째) 저장소로 그대로 남긴다.
-- 그래야 기존 조회 쿼리와 이미 저장된 결과가 마이그레이션 없이 유효하다.

create table public.generation_job_repositories (
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete restrict,
  position smallint not null check (position between 0 and 4),
  primary key (generation_job_id, repository_id)
);

create unique index generation_job_repositories_position_idx
  on public.generation_job_repositories(generation_job_id, position);

create index generation_job_repositories_repository_idx
  on public.generation_job_repositories(repository_id);

create table public.portfolio_repositories (
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete restrict,
  position smallint not null check (position between 0 and 4),
  primary key (portfolio_id, repository_id)
);

create unique index portfolio_repositories_position_idx
  on public.portfolio_repositories(portfolio_id, position);

create index portfolio_repositories_repository_idx
  on public.portfolio_repositories(repository_id);

-- 기존 행을 대표 저장소 하나짜리 목록으로 채운다.
insert into public.generation_job_repositories (generation_job_id, repository_id, position)
select id, repository_id, 0 from public.generation_jobs
on conflict do nothing;

insert into public.portfolio_repositories (portfolio_id, repository_id, position)
select id, repository_id, 0 from public.portfolios
on conflict do nothing;

alter table public.generation_job_repositories enable row level security;
alter table public.portfolio_repositories enable row level security;
