# 백엔드 작업 로그

이 문서는 REST API, 인증, 데이터베이스, 외부 연동, 비동기 작업과 Worker 등
백엔드 담당 작업을 기록한다. 백엔드 로그 담당자만 수정하며 최신 항목을
위에 추가한다. 아래 기존 기록의 `docs/work-log.md` 표기는 작업 당시 사용한
통합 로그 경로를 의미한다.

## 2026-08-29-29 — 다중 저장소 생성과 포트폴리오 삭제

- 상태: 완료
- 정제된 요청: 저장소를 여러 개 골라 한 번에 포트폴리오를 만들고, 만든
  포트폴리오를 지울 수 있게 한다.
- 배경: 저장소 선택 화면은 다중 선택을 지원했지만 계약·API·DB가 모두 단수라
  첫 번째 하나만 전송됐다. 포트폴리오 삭제는 endpoint 자체가 없었다.
- 결정사항:
  - 저장소는 한 번에 최대 5개까지 받는다.
  - `generation_job_repositories`, `portfolio_repositories` 연결 테이블을 두되
    기존 `repository_id` 컬럼은 대표 저장소로 유지한다. 그래야 기존 조회
    쿼리와 이미 저장된 결과가 그대로 동작한다.
  - 생성 schema에 `repositoryName`을 필수로 넣어 프로젝트를 원래 저장소에
    다시 연결한다. 이 값이 없으면 저장소가 여러 개일 때 `repositoryUrl`이
    엉뚱한 곳을 가리킨다.
  - 삭제는 즉시 영구 삭제한다. Storage 삭제 실패는 로그만 남기고 DB 삭제는
    진행한다.
- 반영 내용:
  - 마이그레이션 `202608290001_multi_repository.sql`을 추가하고 기존 행을
    position 0으로 백필했다.
  - 계약에 `repositoryIds`, `repositoryCount`, `repositories`,
    `DeletePortfolioDto`와 `TOO_MANY_REPOSITORIES`를 추가했다.
  - 증거 수집을 저장소별로 나누고 여러 개일 때 README 상한을 3000자로 줄였다.
  - 순수 함수인 저장소 매칭과 언어 합산을 `repository-matching.ts`로 분리해
    I/O 없이 테스트할 수 있게 했다.
  - `DELETE /api/v1/portfolios/{portfolioId}`와 `deletePortfolio`를 추가했다.
- 수정 파일:
  - `supabase/migrations/202608290001_multi_repository.sql`
  - `contracts/api-contract.ts`, `server/http.ts`
  - `server/generation/**`, `server/github/evidence.ts`, `server/openai/**`
  - `server/portfolio/**`, `server/observability/api-logging.ts`
  - `app/api/v1/generations/route.ts`, `app/api/v1/portfolios/**`
  - `architecture.md`, `docs/api-contract.md`, `docs/backend-work-log.md`
- 검증: `tests/multi-repository.test.mjs` 9건을 추가해 position 정렬, 예전
  데이터 대체, 이름 매칭과 중복 방지, 언어 합산을 확인했다. 기존 테스트의
  증거 구조도 함께 갱신해 전체 32건을 통과했다.
- 남은 항목: 마이그레이션을 Supabase SQL Editor에서 실행해야 한다. 실행 전에는
  다중 저장소 요청이 실패한다. 실제 생성 1회로 `repositoryName` 매칭을
  확인하는 것도 남아 있다.

## 2026-08-29-28 — 포트폴리오 생성 분량 규격 적용

- 상태: 완료
- 정제된 요청: 결과 화면이 단일 컬럼으로 훑어 읽히도록 생성 단계에서 분량
  상한을 정한다.
- 배경: 생성 지침과 JSON schema 어디에도 길이·개수 제한이 없어 저장된 결과
  6건의 실측이 introduction 168~248자, highlights 5~7개, techStack 7~13개였다.
- 결정사항:
  - 상한은 headline 60자, introduction 150자, description 120자,
    highlights 3개, challenges·solutions·impact 각 2개, techStack 8개,
    skills 4개 그룹과 그룹당 6개, notablePatterns 4개로 정한다.
  - 상한은 채워야 할 목표가 아니라 한계다. 근거가 부족하면 빈 배열을 반환하는
    기존 원칙을 유지한다.
  - 규격은 생성 지침, JSON schema, DTO 변환 세 곳에서 함께 지킨다. 규격 이전에
    저장된 결과도 마지막 단계에서 상한이 적용되도록 한다.
- 반영 내용:
  - `portfolio-prompt.ts`에 분량 지침과 우선순위 규칙을 추가했다.
  - `portfolio-generator.ts`의 schema에 `maxItems`를 넣었다.
  - `mapper.ts`에 `CONTENT_LIMITS`를 두고 `readStringArray`가 개수를 받도록
    확장해 방어적으로 잘랐다.
  - `contracts/api-contract.ts`에 타입 변경 없이 규격을 주석으로 명시했다.
- 수정 파일:
  - `server/openai/portfolio-prompt.ts`
  - `server/openai/portfolio-generator.ts`
  - `server/portfolio/mapper.ts`
  - `contracts/api-contract.ts`
  - `architecture.md`
  - `docs/backend-work-log.md`
- 검증: `tests/portfolio-content-limits.test.mjs` 4건을 추가해 상한 적용, 순서
  보존, 빈 배열 유지와 null 보존을 확인했다. ESLint와 TypeScript 검사를 통과했다.
- 남은 항목: 실제 생성 1회를 돌려 모델 응답이 상한을 지키는지 확인한다.

## 2026-08-16-27 — 생성 요청 작업 조회 관계 오류 수정

- 상태: 완료
- 정제된 요청: 프론트엔드 코드를 변경하지 않고, 포트폴리오 생성 요청에서
  생성 작업 조회 오류가 “저장소 없음” 404로 표시되어 대기 화면 전환을 막는
  문제를 바로잡는다.
- 제약조건:
  - 실제 소유 저장소가 없을 때의 `NOT_FOUND` 응답은 유지한다.
  - Supabase 원본 오류나 인증 정보는 클라이언트 응답과 로그에 노출하지 않는다.
- 결정사항:
  - `generation_jobs`와 `portfolios`의 두 FK 관계는 명시적인
    `generation_jobs_portfolio_id_fkey` 조인으로 선택한다.
  - 저장소·생성 작업 조회는 DB 오류를 `null`로 숨기지 않고, 실제 데이터가
    없을 때만 `NOT_FOUND`로 처리한다.
- 반영 내용:
  - 생성 직후 상태 조회를 막던 모호한 `portfolios(...)` 임베드를 명시 조인과
    객체 DTO 매핑으로 교체했다.
  - Supabase 조회 오류와 실제 미존재를 분리하는 `RepositoryLookupError`를
    추가하고, 생성 API가 조회 실패를 구조화 로그에 남기도록 했다.
- 수정 파일: `server/generation/jobs.ts`, `server/github/repositories.ts`,
  `app/api/v1/generations/route.ts`
- 검증: `git diff --check`, 변경 파일 대상 `npx eslint`를 통과했다.
  Supabase 읽기 전용 조회로 명시 조인이 성공하고, 생성 완료 작업 3건을
  정상 반환함을 확인했다. 전체 `npx tsc --noEmit`은 보류된 Toss 결제 작업
  파일의 기존 타입 오류 3건으로 실패했으며, 이번 변경 파일에서는 오류가 없었다.
- 남은 항목: 다중 저장소 생성은 현재 프론트엔드가 HTTP 모드에서 요청 자체를
  차단하고 단일 `repositoryId` 계약을 사용하므로, 계약과 프론트 연동 합의 후
  별도 작업으로 진행한다.

## 2026-08-16-26 — 프론트 HTTP 연결용 API 완성

- 상태: 완료
- 정제된 요청: 프론트엔드 코드를 수정하지 않고 HTTP adapter가 사용하는
  남은 대시보드, 포트폴리오, 결제 mock과 공개 콘텐츠 API를 구현한다.
- 결정사항:
  - 갤러리, 공지와 맛보기는 DB migration 없이 서버 전용 정적 카탈로그로 제공한다.
  - 결제 mock은 실제 승인, 잔액 변경과 DB 결제 이력 저장을 수행하지 않는다.
  - 계정 삭제 Workflow는 현재 프론트 연결 범위에서 제외한다.
- 반영 내용:
  - 대시보드, 크레딧, 결제 상품·checkout·내역, 맛보기, 갤러리와 공지 API를
    계약 DTO로 구현했다.
  - 소유자 기준 포트폴리오 목록·상세와 실패 생성 작업 재시도 API를 추가했다.
  - 정적 공개 데이터는 개인 연락처와 비공개 저장소 URL을 포함하지 않으며,
    모든 새 Route에 domain별 구조화 오류 로그와 request ID를 적용했다.
- 수정 파일: `app/api/v1/**`, `server/auth/session.ts`, `server/billing/**`,
  `server/content/**`, `server/dashboard/**`, `server/generation/jobs.ts`,
  `server/portfolio/**`, `server/observability/api-logging.ts`, 백엔드 테스트.
- 검증: `node --experimental-strip-types --test`로 백엔드 단위 테스트 17건,
  `npx tsc --noEmit`, `npm run lint`, `npm test`, `git diff --check`를 통과했다.
  Codex sandbox의 TCP 제한으로 기존 렌더링 테스트 1건은 skip됐다.

## 2026-08-16-25 — 도메인별 API 오류 로그와 요청 추적 추가

- 상태: 완료
- 정제된 요청: 프론트엔드가 인증, 저장소, 생성, 포트폴리오 API와 연결될 때
  실패 위치를 서버 로그에서 빠르게 식별할 수 있게 한다.
- 결정사항:
  - Vercel console에서 검색 가능한 JSON 로그에 domain, operation, route template,
    HTTP method, status, error code, request ID와 처리 시간을 기록한다.
  - 요청 본문, query string, cookie, access token과 원본 오류 stack은 로그에
    남기지 않으며 오류 메시지의 Bearer token·key·secret 값은 마스킹한다.
  - 모든 API 응답에 `x-request-id`를 넣고, 오류 응답에는 기존 JSON body를
    유지한 채 `x-api-error-code` 헤더를 추가한다.
- 반영 내용:
  - auth, repositories, generations, portfolios Route Handler 전체를 공통 로거로
    감쌌다.
  - GitHub OAuth callback, 저장소 동기화, 생성 작업 생성과 Workflow 시작·실행
    실패에 원인과 job ID를 포함한 도메인 로그를 추가했다.
- 수정 파일: `server/observability/api-logging.ts`, `server/http.ts`, `app/api/v1/**`,
  `server/generation/jobs.ts`, `workflows/generate-portfolio.ts`,
  `tests/api-logging.test.mjs`
- 검증: `node --experimental-strip-types --test tests/portfolio-prompt.test.mjs
  tests/api-logging.test.mjs`, `npx tsc --noEmit`, `npm run lint`, `npm test`를
  통과했다. Codex sandbox의 TCP 제한으로 기존 렌더링 테스트 1건은 skip됐다.

## 2026-08-16-24 — 근거 기반 OpenAI 포트폴리오 프롬프트 고도화

- 상태: 완료
- 정제된 요청: 프론트엔드와 REST API 계약을 변경하지 않고, GitHub 근거를
  우선하는 채용형 포트폴리오 생성 품질을 높인다.
- 결정사항:
  - 사용자 프롬프트와 강조 항목은 표현 우선순위에만 사용하고, 저장소 근거와
    충돌할 경우 사실로 반영하지 않는다.
  - README, 커밋·PR 제목과 사용자 입력은 참고 자료로 구분해 포함된 지시를
    실행하지 않도록 한다.
  - 기존 `tone` 값은 `professional`, `concise`, `storytelling` 문체 규칙으로
    실제 OpenAI 지침에 반영한다.
- 반영 내용:
  - 선호도와 저장소 근거를 분리하는 프롬프트 빌더를 추가했다.
  - 수치·역할·기술·성과 환각 방지, 단일 저장소 단일 프로젝트, 근거 부족 시
    빈 배열 반환과 중립적 역할 표현 규칙을 추가했다.
  - 생성 Workflow가 저장된 `tone`을 조회해 GitHub 근거 수집과 OpenAI 요청에
    전달하도록 연결했다.
- 수정 파일: `server/openai/**`, `server/github/evidence.ts`,
  `server/generation/runner.ts`, `tests/portfolio-prompt.test.mjs`
- 검증: `node --experimental-strip-types --test tests/portfolio-prompt.test.mjs`,
  `npx tsc --noEmit`, `npm run lint`를 통과했다.

## 2026-08-16-23 — Vercel 런타임과 Workflow 전환

- 상태: 완료
- 정제된 요청: Cloudflare 의존성을 제거하고 Vercel 기반으로 전환한다.
  프론트엔드 화면과 REST API 계약은 유지한다.
- 반영 내용:
  - `vinext`, Vite, Wrangler와 Cloudflare Worker 진입점을 표준 Next.js 16과
    Vercel Workflow SDK로 교체했다.
  - 서버 환경 변수 접근을 `process.env` 기반 서버 모듈로 통일하고, 생성 요청은
    Vercel Workflow run ID를 기존 `workflow_instance_id`에 저장하도록 변경했다.
  - Workflow 재시도 중 결과가 중복 저장되지 않도록 포트폴리오 저장을
    `generation_job_id` 기준 upsert로 처리했다.
  - Vercel 환경 변수, GitHub OAuth callback, Production/Preview 설정을 문서화했다.
- 수정 파일: 런타임 설정, `server/**`, `workflows/**`, 생성 API, 환경·아키텍처 문서와
  렌더링 테스트.
- 검증:
  - `git diff --check`, `npx tsc --noEmit`, `npm run lint`를 통과했다.
  - `next build --webpack`에서 Vercel Workflow 내부 route 3개 생성을 확인했다.
  - Node 테스트는 1건 통과했고, TCP listener가 차단된 Codex sandbox에서는
    실제 Next 서버 렌더링 테스트 1건을 skip 처리했다. 일반 로컬 환경에서는 해당
    테스트가 `next start`로 대시보드를 검증한다.

## 2026-08-16-22 — OpenAI 포트폴리오 생성 Workflow 구현

- 상태: 완료
- 반영 내용: GitHub README와 최근 커밋·PR 제목을 일시 근거로 수집하고,
  OpenAI Responses API의 strict JSON output을 포트폴리오 콘텐츠로 저장한다.
- 보안: 원본 코드와 활동 본문은 저장하지 않으며, OpenAI 오류 원문을
  사용자에게 노출하지 않는다.
- 수정 파일: `server/openai/**`, `server/github/evidence.ts`,
  `server/generation/runner.ts`, `worker/**`
- 검증: TypeScript와 ESLint 검사를 수행한다.

## 2026-08-16-15 — 서버 환경 변수 가이드 추가

- 상태: 완료
- 반영 내용: Supabase, GitHub OAuth, token 암호화와 OpenAI 설정을 위한
  비밀값 없는 `.env.example`과 로컬·배포 설정 안내를 추가했다.
- 수정 파일: `.env.example`, `docs/environment.md`, `docs/work-log.md`
- 검증: 비밀값 포함 여부와 Markdown diff를 검사한다.

## 2026-08-16-14 — PDF 이력서 다운로드 API 구현

- 상태: 완료
- 반영 내용: 소유자 검증 뒤 private Supabase Storage의 PDF만 반환하는
  포트폴리오 이력서 다운로드 endpoint를 추가했다.
- 수정 파일: `app/api/v1/portfolios/**`, `server/portfolio/resume.ts`
- 검증: TypeScript와 lint 검사를 수행한다.

## 2026-08-16-13 — 생성 작업 polling API 구현

- 상태: 완료
- 반영 내용: 생성 작업 생성과 상태 조회 API를 추가하고, 사용자당 활성 작업
  하나를 Postgres unique index와 `409 GENERATION_IN_PROGRESS` 응답으로 제한했다.
- 수정 파일: `app/api/v1/generations/**`, `server/generation/jobs.ts`, 공유 API 계약
- 검증: TypeScript와 lint 검사를 수행한다.

## 2026-08-16-12 — GitHub 저장소 동기화 API 구현

- 상태: 완료
- 정제된 요청: 로그인 사용자의 public·private GitHub 저장소를 암호화된 연결
  token으로 동기화하고, 프론트 계약에 맞춰 목록·상세 조회 API를 제공한다.
- 결정사항:
  - 저장소 목록은 최대 1,000개까지 GitHub API에서 동기화한다.
  - 목록 검색과 필터는 사용자 소유의 저장된 메타데이터에만 적용한다.
  - 원본 코드와 커밋 본문은 요청하거나 저장하지 않는다.
- 반영 내용:
  - 저장소 동기화, 목록과 상세 Route Handler를 구현했다.
  - GitHub rate limit과 연결 오류를 계약 오류 코드로 변환했다.
- 수정 파일:
  - `app/api/v1/repositories/**`
  - `server/github/repositories.ts`
  - `server/auth/require-user.ts`
  - `docs/work-log.md`
- 검증: TypeScript와 lint 검사를 수행한다.
- 남은 항목: 생성 작업, PDF 다운로드와 계정 삭제 API를 구현한다.

## 2026-08-16-11 — GitHub OAuth와 서버 세션 API 구현

- 상태: 완료
- 정제된 요청: private GitHub 저장소 접근에 필요한 OAuth 연결과 서버 세션
  API를 프론트엔드 코드 변경 없이 구현한다.
- 결정사항:
  - OAuth scope는 `read:user`, `user:email`, `repo`, `read:org`로 고정한다.
  - OAuth state는 짧은 만료의 HttpOnly cookie로 검증한다.
  - GitHub token은 AES-GCM으로 암호화하고, 세션 token은 해시만 저장한다.
- 반영 내용:
  - GitHub 로그인 시작·callback·세션 조회·로그아웃 endpoint를 구현했다.
  - GitHub 사용자와 암호화 연결 정보를 Supabase에 upsert하고 서버 세션을 발급한다.
- 수정 파일:
  - `app/api/v1/auth/**`
  - `server/auth/**`
  - `server/http.ts`
  - `docs/work-log.md`
- 검증: TypeScript와 lint 검사를 수행한다.
- 남은 항목: 저장소 동기화와 생성 작업 API를 구현한다.

## 2026-08-16-10 — Supabase 초기 스키마와 서버 client 추가

- 상태: 완료
- 정제된 요청: 프론트엔드 코드를 변경하지 않고 GitHub OAuth, 저장소 분석,
  생성 작업, PDF와 계정 삭제를 지원하는 Supabase 초기 스키마를 추가한다.
- 제약조건:
  - GitHub 원본 코드와 커밋 본문은 저장하지 않는다.
  - Storage PDF는 private bucket에 보관하고 서버 API로만 제공한다.
  - 모든 데이터 접근은 Workers의 server-only Supabase client를 사용한다.
- 결정사항:
  - 활성 생성 작업은 사용자당 하나만 허용하는 부분 unique index로 강제한다.
  - RLS를 모든 public 테이블과 Storage object에 적용하고, 브라우저 직접 접근
    정책은 만들지 않는다.
  - 계정 삭제는 완료 후 사용자 데이터를 지울 수 있도록 별도 작업 테이블로 관리한다.
- 반영 내용:
  - Postgres enum, 테이블, 인덱스, trigger, RLS와 private `resumes` bucket
    migration을 추가했다.
  - Workers 전용 Supabase client와 Cloudflare module 타입 선언을 추가했다.
  - 더 이상 사용하지 않는 D1 예제와 Worker DB binding을 제거했다.
- 수정 파일:
  - `supabase/migrations/202608160001_initial_backend.sql`
  - `server/supabase/client.ts`
  - `server/supabase/types.ts`
  - `types/backend/cloudflare-workers.d.ts`
  - `worker/index.ts`
  - `architecture.md`
  - `docs/work-log.md`
- 검증: TypeScript와 SQL migration 검사를 수행한다.
- 남은 항목: GitHub OAuth, 저장소 동기화와 생성 API를 구현한다.

## 2026-08-16-09 — Supabase 저장소 기반 전환

- 상태: 완료
- 정제된 요청: Cloudflare Worker 실행 구조는 유지하고, 관계형 데이터와 PDF
  저장소를 Supabase Postgres와 Supabase Storage로 전환한다.
- 결정사항:
  - 서버는 Workers의 server-only Supabase client로 Postgres와 Storage에 접근한다.
  - Supabase Auth는 사용하지 않고 GitHub OAuth와 세션 관리는 기존 Workers
    서버가 담당한다.
  - D1, R2와 Drizzle 의존성은 백엔드 구현에서 제거한다.
- 반영 내용:
  - `@supabase/supabase-js`를 추가하고 Drizzle 의존성과 생성 스크립트를 제거했다.
  - 아키텍처와 PDF 다운로드 계약의 저장소 기준을 Supabase로 갱신했다.
- 수정 파일:
  - `package.json`
  - `package-lock.json`
  - `architecture.md`
  - `docs/api-contract.md`
  - `docs/work-log.md`
- 검증: 의존성 설치 후 문서 diff 검사를 수행한다.
- 남은 항목: Postgres migration, server-only client와 API 구현을 추가한다.

## 2026-08-16-08 — Cloudflare 백엔드와 PDF 이력서 기준 확정

- 상태: 완료
- 정제된 요청: 프론트엔드가 mock 계약을 기준으로 병렬 개발할 수 있도록
  Cloudflare 기반 백엔드 실행 구조와 PDF 이력서 결과 계약을 확정한다.
- 제약조건:
  - 기존 `vinext`와 Cloudflare Workers + D1 기반을 유지한다.
  - GitHub access token, R2 object key와 암호화 키를 API 응답이나 로그에
    노출하지 않는다.
  - PDF 이력서는 MVP 결과물에 포함하고, 크레딧과 결제는 계속 mock으로 유지한다.
- 결정사항:
  - 비동기 분석·AI 생성·PDF 렌더링은 Cloudflare Workflows가 수행한다.
  - PDF는 Cloudflare Browser Rendering으로 생성해 R2 비공개 객체로 저장한다.
  - PDF는 소유자 검증을 하는
    `/api/v1/portfolios/{portfolioId}/resume.pdf`로만 제공한다.
  - 생성 완료 상태에는 `resumePdfAvailable`을, 포트폴리오 결과에는
    `resumePdf`를 포함한다.
- 반영 내용:
  - Worker, D1, Workflow, R2와 Browser Rendering 책임 및 생성 단계를
    아키텍처에 추가했다.
  - PDF 렌더링 단계를 생성 상태와 공유 TypeScript DTO에 반영했다.
  - 프론트엔드가 사용할 PDF 다운로드 URL과 접근 제어 규칙을 API 계약에 명시했다.
- 수정 파일:
  - `architecture.md`
  - `contracts/api-contract.ts`
  - `docs/api-contract.md`
  - `docs/work-log.md`
- 검증: 공유 계약 TypeScript 검사와 문서 diff 검사를 수행한다.
- 남은 항목: Cloudflare Browser Rendering, R2와 Workflow binding을 배포
  환경에 설정한다.
