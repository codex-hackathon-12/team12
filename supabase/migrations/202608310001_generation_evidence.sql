-- 생성 파이프라인을 단계별로 나누기 위한 중간 저장소다.
--
-- 지금까지는 GitHub 근거 수집, OpenAI 호출, 포트폴리오 저장이 하나의 step이었다.
-- 그래서 저장 단계에서 실패해 재시도가 걸리면 GitHub을 다시 읽고 모델도 다시
-- 호출했다. 비용이 되풀이되고, 같은 입력에 다른 결과가 나올 수도 있었다.
--
-- 단계 사이 값을 workflow 인자로 넘기지 않고 여기 둔다. README를 포함한 근거는
-- 수십 KB라 이벤트 로그에 직렬화하기에 너무 크다. 단계는 jobId만 주고받는다.

create table public.generation_evidence (
  generation_job_id uuid primary key references public.generation_jobs(id) on delete cascade,
  evidence jsonb not null,
  -- 모델 응답. 저장 단계가 실패해 다시 돌아도 재호출하지 않기 위해 남긴다.
  draft jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger generation_evidence_set_updated_at
before update on public.generation_evidence
for each row execute function public.set_updated_at();

alter table public.generation_evidence enable row level security;
