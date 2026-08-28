-- 포트폴리오를 비로그인 사용자에게 보여줄 수 있는 공개 링크를 추가한다.
-- published_at이 null이면 비공개다.
-- 슬러그는 한 번 만들면 유지한다. 공개를 껐다 켜도 이미 보낸 링크가 살아 있어야 한다.

alter table public.portfolios
  add column public_slug text unique,
  add column published_at timestamptz;

create index portfolios_public_slug_idx
  on public.portfolios(public_slug)
  where published_at is not null;
