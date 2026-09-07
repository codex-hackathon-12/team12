-- 결정 후보의 주제 분류 캐시.
--
-- 후보를 최근 커밋·PR 제목 나열로 만들었더니 "fix(...): ..." 같은 잔버그
-- 제목이 결정 후보로 섰다. 모델이 커밋·PR 전체를 읽고 주제로 묶는 것으로
-- 바꾸는데, 그 분류는 근거가 바뀌지 않는 한 같으므로 저장소마다 한 번만
-- 계산하고 여기 캐시한다.
--
-- generation_evidence에 두는 이유는 수명이 같기 때문이다. 분류는 근거의
-- 파생물이라 근거가 사라지면 함께 사라져야 하고, 이 테이블은 작업에 cascade,
-- 작업은 포트폴리오가 사는 동안 restrict로 남는다.
--
-- 모양: { [repositoryName]: [{ title, summary, evidence: [...] }] }
alter table public.generation_evidence
  add column decision_topics jsonb;
