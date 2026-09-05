-- 되묻기 질문을 "하나의 결정"으로 묶는다.
--
-- 지금 질문은 항목 단위라 "성과를 알려주세요"처럼 넓다. 넓게 물으면 무엇을
-- 답해야 할지 알 수 없어 사람은 아무 말이나 적거나 그냥 닫는다.
--
-- 한 결정을 문제·선택·결과 셋으로 나눠 물으면 각 질문이 한두 문장으로 답할
-- 만해진다. 다만 셋은 같은 결정에 대한 것이므로 화면에서 한 카드로 묶여야
-- 하고, 무엇에 대한 질문인지도 함께 보여야 한다. topic이 그 자리다.
--
-- 예: "재시도 처리를 withRetry로 감싼 커밋"
--
-- 낱개 질문은 topic이 null이다. 기존 행도 전부 null이라 지금처럼 낱개로
-- 그려진다.

alter table public.portfolio_statements
  add column topic text;

-- 결정의 세 조각을 field 값으로 받는다. 제약 이름은 테이블을 만들 때 자동으로
-- 붙은 것이라 새로 만들려면 먼저 지워야 한다.
alter table public.portfolio_statements
  drop constraint portfolio_statements_field_check;

alter table public.portfolio_statements
  add constraint portfolio_statements_field_check
  check (field in (
    'impact', 'challenges', 'solutions', 'role', 'highlights',
    'decisionProblem', 'decisionApproach', 'decisionOutcome'
  ));

-- 유니크 인덱스는 (portfolio_id, repository_name, field) 그대로 둔다.
-- 결정 세 조각은 field가 서로 달라 자연히 구분되고, 한 포트폴리오의 한
-- 저장소에 결정은 하나뿐이라는 제약이 덤으로 걸린다.
