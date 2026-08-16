# 백엔드 작업 로그

이 문서는 REST API, 인증, 데이터베이스, 외부 연동, 비동기 작업과 Worker 등
백엔드 담당 작업을 기록한다. 백엔드 로그 담당자만 수정하며 최신 항목을
위에 추가한다. 아래 기존 기록의 `docs/work-log.md` 표기는 작업 당시 사용한
통합 로그 경로를 의미한다.

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
