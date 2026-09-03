-- 초안이 채우지 못한 자리에 대한 질문과 지원자의 답을 담는다.
--
-- 저장소에는 코드와 기록만 있고 "왜 그렇게 했는지"와 "그래서 무엇이 달라졌는지"는
-- 없다. 그건 만든 사람만 안다. 이력서에서 가장 값진 것이 정확히 그 둘이라,
-- 빈칸을 모델이 그럴듯하게 메우게 하는 대신 지원자에게 되묻는다. 지어낸 수치는
-- 면접의 후속 질문 하나에 무너지지만, 본인이 쓴 답은 그대로 설명할 수 있다.
--
-- generation_evidence에 얹지 않고 새 테이블로 둔다. 그쪽은 generation_jobs에
-- cascade로 묶인 생성 파이프라인의 중간 산출물이고, 답변은 포트폴리오가 사는
-- 동안 살아야 하는 사용자 데이터다. 수명이 다른 것을 같은 행에 두면 한쪽을
-- 지울 때 다른 쪽이 함께 사라진다.

create table public.portfolio_statements (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  -- 소유자 조건을 조인 없이 걸기 위해 함께 둔다. 답변은 본인만 쓰고 읽는다.
  user_id uuid not null references public.users(id) on delete cascade,
  -- 저장소 전체에 대한 질문이면 null. 프로젝트별 질문이면 그 저장소 이름이다.
  repository_name text,
  field text not null check (field in ('impact', 'challenges', 'solutions', 'role', 'highlights')),
  question text not null,
  -- 아직 답하지 않았으면 null. 사용자가 쓴 그대로 저장한다. 요약해 두면
  -- 그것을 다시 근거로 쓸 때 요약하며 잃은 것이 사실로 굳는다.
  answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 같은 자리를 두 번 묻지 않는다. 다시 답하면 새 행이 쌓이는 대신 덮어쓴다.
-- repository_name이 null인 행(저장소 전체 질문)도 하나로 묶여야 하므로
-- nulls not distinct가 필요하다. 기본값(nulls distinct)이면 null 행은 서로
-- 다른 것으로 취급돼 제한이 걸리지 않는다.
create unique index portfolio_statements_slot_key
  on public.portfolio_statements (portfolio_id, repository_name, field)
  nulls not distinct;

create index portfolio_statements_portfolio_id_idx
  on public.portfolio_statements (portfolio_id, created_at);

create trigger portfolio_statements_set_updated_at
before update on public.portfolio_statements
for each row execute function public.set_updated_at();

-- 다른 테이블과 같다. 서버가 service role로만 접근하며 익명 접근을 막는다.
alter table public.portfolio_statements enable row level security;
