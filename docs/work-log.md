# 작업 로그

이 문서는 사용자 요청, 주요 결정, 실제 반영 내용과 검증 결과를 시간순으로 추적한다. 요청은 원문을 그대로 복사하지 않고 목표, 제약조건과 완료 기준이 드러나도록 정제한다. 최신 항목을 위에 추가하며 통합 담당자만 수정한다.

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
  - RLS를 모든 public 테이블과 Storage object에 적용하고, 브라우저 직접 접근 정책은 만들지 않는다.
  - 계정 삭제는 완료 후 사용자 데이터를 지울 수 있도록 별도 작업 테이블로 관리한다.
- 반영 내용:
  - Postgres enum, 테이블, 인덱스, trigger, RLS와 private `resumes` bucket migration을 추가했다.
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
- 정제된 요청: Cloudflare Worker 실행 구조는 유지하고, 관계형 데이터와 PDF 저장소를
  Supabase Postgres와 Supabase Storage로 전환한다.
- 결정사항:
  - 서버는 Workers의 server-only Supabase client로 Postgres와 Storage에 접근한다.
  - Supabase Auth는 사용하지 않고 GitHub OAuth와 세션 관리는 기존 Workers 서버가 담당한다.
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
  - GitHub access token, R2 object key와 암호화 키를 API 응답이나 로그에 노출하지 않는다.
  - PDF 이력서는 MVP 결과물에 포함하고, 크레딧과 결제는 계속 mock으로 유지한다.
- 결정사항:
  - 비동기 분석·AI 생성·PDF 렌더링은 Cloudflare Workflows가 수행한다.
  - PDF는 Cloudflare Browser Rendering으로 생성해 R2 비공개 객체로 저장한다.
  - PDF는 소유자 검증을 하는 `/api/v1/portfolios/{portfolioId}/resume.pdf`로만 제공한다.
  - 생성 완료 상태에는 `resumePdfAvailable`을, 포트폴리오 결과에는 `resumePdf`를 포함한다.
- 반영 내용:
  - Worker, D1, Workflow, R2와 Browser Rendering 책임 및 생성 단계를 아키텍처에 추가했다.
  - PDF 렌더링 단계를 생성 상태와 공유 TypeScript DTO에 반영했다.
  - 프론트엔드가 사용할 PDF 다운로드 URL과 접근 제어 규칙을 API 계약에 명시했다.
- 수정 파일:
  - `architecture.md`
  - `contracts/api-contract.ts`
  - `docs/api-contract.md`
  - `docs/work-log.md`
- 검증: 공유 계약 TypeScript 검사와 문서 diff 검사를 수행한다.
- 남은 항목: Cloudflare Browser Rendering, R2와 Workflow binding을 배포 환경에 설정한다.

## 2026-08-16-07 — 개발 기준 문서 기준점 커밋

- 상태: 완료
- 정제된 요청: 현재까지 작성한 협업 규칙, 제품 아키텍처, REST API 계약, 커밋 정책과 작업 로그를 `develop` 브랜치의 기준점 커밋 하나로 기록한다.
- 제약조건:
  - 서로 관련된 개발 기준 파일만 명시적으로 stage한다.
  - 커밋 메시지는 한글 커밋 정책을 따른다.
  - 원격 push는 이번 작업 범위에 포함하지 않는다.
- 결정사항:
  - 현재 브랜치인 `develop`에서 커밋한다.
  - 커밋 타입은 프로젝트 기반 정리를 의미하는 `chore`를 사용한다.
  - 프론트·백 구현 코드가 아직 없으므로 기준 문서와 계약을 하나의 초기 커밋으로 묶는다.
- 반영 내용:
  - 협업 및 파일 소유권 정책을 기록한다.
  - 대시보드 중심 아키텍처와 기능별 API 계약을 기록한다.
  - mock 우선 연동, 상세 작업 로그와 한글 커밋 정책을 기록한다.
- 수정 파일:
  - `AGENTS.md`
  - `architecture.md`
  - `contracts/api-contract.ts`
  - `docs/api-contract.md`
  - `docs/commit-policy.md`
  - `docs/work-log.md`
- 검증: Markdown diff 검사와 공유 TypeScript 계약의 독립 타입 검사를 수행한다.
- 남은 항목: 원격 `develop` 브랜치 push는 별도 요청 후 수행한다.

## 2026-08-16-06 — 한글 커밋 메시지 정책

- 상태: 완료
- 정제된 요청: 커밋 제목과 본문의 길이, 문체, 언어, 타입, 구조와 이슈 참조 방식을 별도 Markdown 정책으로 정리하고 모든 통합 커밋에 적용한다.
- 제약조건:
  - Header와 Body, Footer는 빈 행으로 구분한다.
  - Header 전체는 50자 이내, Body 각 행은 72자 이내로 작성한다.
  - 제목은 과거형과 마침표를 사용하지 않는다.
  - 메시지 설명은 반드시 한글로 작성하고 무엇과 왜를 중심으로 기록한다.
  - 커밋 타입은 지정된 10개 값 중 하나만 사용한다.
- 결정사항:
  - 전달된 목록이 8개 항목이므로 문서 제목을 `8가지 규칙`으로 바로잡았다.
  - 타입·스코프 식별자, 코드, 파일명, 제품명과 이슈 키워드는 한글 규칙의 예외로 둔다.
  - 한글에는 대소문자가 없으므로 영문 고유명사로 시작할 때만 대문자 규칙을 적용한다.
  - 커밋 단위, 작성 예시와 커밋 전 확인 목록도 같은 문서에서 관리한다.
- 반영 내용:
  - Header, Body, Footer 작성법과 허용 타입을 문서화했다.
  - 좋은 예, 나쁜 예, 전체 메시지 예시와 금지 Git 작업을 추가했다.
  - `AGENTS.md`가 커밋 정책을 필수 기준으로 참조하도록 연결했다.
- 수정 파일:
  - `docs/commit-policy.md`
  - `AGENTS.md`
  - `docs/work-log.md`
- 검증: Markdown diff 검사를 통과했고, 허용 타입·한글 예시·줄 길이 원칙과 기존 Git 정책의 일치 여부를 확인했다.
- 남은 항목: 실제 commit과 push는 통합 담당자의 별도 작업으로 남아 있다.

## 2026-08-16-05 — 상세 로그와 Mock 우선 협업 정책

- 상태: 완료
- 정제된 요청: 이후 모든 작업을 상세한 Markdown 로그로 남기고, 사용자 요청을 실행 가능한 요구사항으로 정제해 기록한다. 프론트엔드와 백엔드의 병렬 개발 중에는 파일 충돌을 방지하며, 백엔드가 완성되기 전까지 프론트엔드는 공유 API 계약에 맞춘 mock 데이터만 사용한다. 실제 API 전환 시 화면 코드를 수정하지 않는 구조를 강제한다.
- 제약조건:
  - 로그에는 비밀 정보, 개인정보와 비공개 저장소 내용을 포함하지 않는다.
  - 일반 작업 에이전트는 공유 로그를 직접 수정하지 않는다.
  - 프론트엔드는 미완성 REST endpoint를 직접 호출하지 않는다.
  - mock과 실제 HTTP 응답은 동일한 DTO를 사용한다.
- 결정사항:
  - 상세 로그의 기준 파일은 `docs/work-log.md`다.
  - mock fixture는 `mocks/api/**`, API adapter는 `lib/api-client/adapters/**`에 둔다.
  - UI는 `lib/api-client/index.ts`만 사용한다.
  - 기본 개발 adapter는 mock이며, 통합 승인 후 설정만 HTTP adapter로 바꾼다.
- 반영 내용:
  - 로그 작성 책임, 형식과 보안 규칙을 협업 정책에 추가했다.
  - 프론트엔드 mock 전용 파일 소유권과 백엔드 수정 금지 영역을 지정했다.
  - mock·HTTP adapter 경계와 전환 절차를 아키텍처에 추가했다.
  - 기능별 최소 mock 시나리오를 API 계약 문서에 추가했다.
- 수정 파일:
  - `AGENTS.md`
  - `architecture.md`
  - `docs/api-contract.md`
  - `docs/work-log.md`
- 검증: Markdown diff 검사를 통과했고, `mocks/api/**`와 adapter 경로가 정책·아키텍처·API 문서에서 일치함을 확인했다.
- 남은 항목: 실제 프론트엔드 개발 시작 시 API client 인터페이스, mock fixture와 두 adapter를 구현한다.

## 2026-08-16-04 — 기능별 REST API 데이터 계약

- 상태: 완료
- 정제된 요청: GitHub 전용 로그인, 구조화된 포트폴리오 결과와 mock 크레딧 정책을 기준으로 기능별 요청·응답 데이터 형식을 정의한다.
- 제약조건:
  - 로그인 제공자는 GitHub로 고정한다.
  - 포트폴리오는 프로필, 자기소개, 기술 스택, 프로젝트, Git 분석 결과와 연락처를 포함한다.
  - 표시 크레딧은 신규 사용자 기준 100이다.
  - 저장소 하나당 예상 비용은 30이지만 MVP에서는 차감하지 않는다.
  - 결제도 실제 승인 없이 mock으로 동작한다.
- 결정사항:
  - 모든 일반 API는 `/api/v1`과 공통 성공·실패 envelope를 사용한다.
  - GitHub OAuth redirect endpoint만 JSON envelope의 예외로 둔다.
  - TypeScript 공유 계약을 데이터 형식의 기계 판독 기준으로 사용한다.
  - 생성 작업은 `jobId`와 상태 polling 계약을 사용한다.
- 반영 내용:
  - 인증, 대시보드, 저장소, 크레딧, 생성, 포트폴리오, 맛보기, mock 결제, 갤러리와 공지 계약을 작성했다.
  - mock 크레딧 응답에 `willCharge: false`, `chargingEnabled: false`, `isMock: true`를 명시했다.
  - 아키텍처의 미확정 인증·결제 표현을 확정 정책으로 갱신했다.
- 수정 파일:
  - `architecture.md`
  - `contracts/api-contract.ts`
  - `docs/api-contract.md`
- 검증:
  - `contracts/api-contract.ts` 단독 TypeScript 검사를 통과했다.
  - 전체 프로젝트 TypeScript 검사에는 기존 Cloudflare Worker 전역 타입인 `cloudflare:workers`, `Fetcher`, `D1Database` 누락 오류가 남아 있다. 새 계약 파일에서 발생한 오류는 아니다.
- 남은 항목: 백엔드 구현 전에 각 endpoint의 실제 handler와 검증 스키마를 계약에 맞춰 작성한다.

## 2026-08-16-03 — 화면과 시스템 아키텍처

- 상태: 완료
- 정제된 요청: 대시보드를 메인 화면으로 두고 저장소 선택, 프롬프트 입력, 생성 대기, 결과, 결제와 갤러리까지의 페이지 구조와 시스템 경계를 정의한다.
- 제약조건:
  - 대시보드는 로그인, 맛보기, 주요 진입점, 공지와 이벤트를 포함한다.
  - 저장소 선택 후 프롬프트를 입력하고, 대기 화면을 거쳐 결과로 이동한다.
  - 갤러리는 완성 포트폴리오 예시를 반응형 그리드로 제공한다.
  - 프론트엔드와 백엔드는 REST API로 통신한다.
- 결정사항:
  - 메인 경로는 `/dashboard`다.
  - 생성 작업은 새로고침 복구가 가능한 `jobId` 기반 polling을 사용한다.
  - 포트폴리오 스타일은 MVP에서 하나만 제공한다.
  - 갤러리에는 운영자가 준비한 예시 데이터를 우선 사용한다.
- 반영 내용:
  - 라우트, 페이지별 상태, 생성 sequence, 시스템 레이어와 데이터 모델을 문서화했다.
  - MVP 구현 우선순위와 미확정 제품 정책을 분리했다.
- 수정 파일:
  - `architecture.md`
- 검증: Markdown 형식과 Mermaid 블록 구조를 점검했다.
- 남은 항목: 실제 페이지와 API 구현은 아직 시작하지 않았다.

## 2026-08-16-02 — 프론트엔드·백엔드 협업 정책

- 상태: 완료
- 정제된 요청: 같은 `develop` 브랜치와 작업 공간에서 프론트엔드와 백엔드가 충돌 없이 병렬 개발할 수 있도록 파일 소유권, REST API 계약, 커밋과 push 정책을 정의한다.
- 제약조건:
  - 프론트엔드와 백엔드는 서로의 담당 파일을 수정하지 않는다.
  - 공유 파일은 통합 담당자만 변경한다.
  - 일반 작업 에이전트는 Git 상태를 변경하지 않는다.
- 결정사항:
  - Git 작업은 통합 담당자 한 명이 직렬로 수행한다.
  - `git add .`, force push와 다른 담당자 변경 복구를 금지한다.
  - `architecture.md`를 제품과 기술 구조의 단일 기준으로 사용한다.
- 반영 내용:
  - 역할별 수정 가능·금지 경로를 지정했다.
  - API 계약 변경 순서, 검증과 완료 보고 형식을 정의했다.
  - Conventional Commits 메시지 규칙을 추가했다.
- 수정 파일:
  - `AGENTS.md`
- 검증: 파일 경로와 Markdown 형식을 점검했다.
- 남은 항목: 실제 Git commit과 push는 수행하지 않았다.

## 2026-08-16-01 — 프로젝트 초기 설정

- 상태: 완료
- 정제된 요청: 화면 구현 없이 취업 포트폴리오 AI를 바로 개발할 수 있는 Next.js 호환 프로젝트의 초기 구조와 실행 환경만 준비한다.
- 제약조건:
  - 제품 UI는 기본 로딩 템플릿 상태로 유지한다.
  - 이후 프론트엔드와 백엔드 기능을 추가할 수 있는 구조를 사용한다.
- 결정사항:
  - Next.js App Router 호환 vinext 구조를 사용한다.
  - Node.js 최소 버전은 22.13으로 지정한다.
  - React 19, TypeScript strict mode, Tailwind CSS 4, Drizzle ORM과 Cloudflare 배포 기반을 포함한다.
- 반영 내용:
  - 프로젝트 템플릿과 의존성을 설치했다.
  - 서비스 메타데이터, Node 버전과 개발 안내 문서를 정리했다.
  - 로컬 개발 서버를 실행하고 프로덕션 빌드를 확인했다.
- 수정 파일:
  - `.nvmrc`
  - `README.md`
  - `package.json`
  - `package-lock.json`
  - 초기 프로젝트 파일 전체
- 검증: vinext 프로덕션 빌드를 통과했다.
- 남은 항목: 제품 화면과 기능 구현은 아직 시작하지 않았다.
