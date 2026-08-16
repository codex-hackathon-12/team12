# folio.ai

https://youtu.be/08R_W-f0S8Q

GitHub 저장소의 코드와 활동 기록을 분석해 취업용 개발자 포트폴리오와
이력서 초안을 만드는 AI 서비스입니다. 사용자는 GitHub로 로그인하고,
저장소와 강조할 경험을 선택한 뒤 생성 과정을 거쳐 하나의 포트폴리오
웹페이지를 받을 수 있습니다.

이 저장소는 Codex Hackathon 12팀의 MVP입니다. 결제와 크레딧은 시연용
mock이며 실제 승인, 지급 또는 차감이 발생하지 않습니다.

## 핵심 기능

- GitHub OAuth 로그인과 서버 세션
- GitHub 저장소 조회·동기화 및 생성 대상 선택
- 지원 직무, 강조 경험과 자유 프롬프트 입력
- Vercel Workflow 기반 저장소 분석·AI 콘텐츠 생성
- 생성 단계 polling과 실패 작업 재시도
- 프로젝트 케이스 스터디 중심의 반응형 포트폴리오 결과
- 소유자 전용 PDF 이력서 다운로드
- 정적 맛보기, 포트폴리오 예시 갤러리와 공지
- 100크레딧 잔액과 저장소당 30크레딧 예상 비용 표시
- mock 상품, checkout과 결제 이력

## 사용자 흐름

```text
공개 랜딩 → GitHub 로그인 → 대시보드 → 저장소 선택
                                      → 프롬프트 입력
                                      → 생성 상태 확인
                                      → 포트폴리오 결과

공개 랜딩 → 맛보기 또는 갤러리
대시보드 → 크레딧·mock 결제 또는 공지
```

로그인하지 않은 사용자는 `/`에서 랜딩을 보고, 로그인한 사용자가 `/`에
접근하면 `/dashboard`로 이동합니다. 로컬에서는
`/?preview=landing`으로 로그인 상태와 관계없이 랜딩 디자인을 확인할 수
있습니다.

## 화면과 라우트

| 경로                              | 접근   | 역할                                     |
| --------------------------------- | ------ | ---------------------------------------- |
| `/`                               | 공개   | 서비스 소개, GitHub 로그인과 정적 맛보기 |
| `/dashboard`                      | 로그인 | 최근 작업, 공지, 크레딧과 생성 진입점    |
| `/repositories`                   | 로그인 | 저장소 검색, 필터와 다중 선택 UI         |
| `/create/[id]/prompt`             | 로그인 | 생성 목적과 프롬프트 입력                |
| `/create/[id]/processing`         | 로그인 | 생성 상태 polling과 재시도               |
| `/portfolios/[portfolioId]`       | 소유자 | 완성 포트폴리오와 PDF 다운로드           |
| `/billing`                        | 로그인 | 크레딧 상품과 mock 결제                  |
| `/gallery`                        | 공개   | 포트폴리오 예시 그리드                   |
| `/gallery/[exampleId]`            | 공개   | 포트폴리오 예시 상세                     |
| `/announcements/[announcementId]` | 공개   | 공지와 이벤트 상세                       |

## 기술 스택

| 영역        | 기술                                                   |
| ----------- | ------------------------------------------------------ |
| 프론트엔드  | Next.js 16 App Router, React 19, TypeScript 5          |
| 스타일      | Tailwind CSS 4 기반 설정, 전역 CSS, Pretendard WOFF2   |
| API         | Next.js Route Handlers, REST `/api/v1`, JSON envelope  |
| 인증·Git    | GitHub OAuth, 암호화된 access token, 서버 세션         |
| 데이터      | Supabase Postgres, private Supabase Storage            |
| 비동기 생성 | Vercel Workflow                                        |
| AI          | OpenAI Responses API, strict JSON schema 출력          |
| 검증        | ESLint, TypeScript, Node.js test runner, Next.js build |
| 배포        | Vercel Preview·Production                              |

## 실행 방법

### 요구 사항

- Node.js 22.13 이상
- npm

저장소의 `.nvmrc`가 지원되는 환경에서는 다음 명령을 사용합니다.

```bash
nvm install
nvm use
npm install
```

### UI를 mock 데이터로 실행

백엔드 환경 변수 없이 전체 화면 흐름을 확인할 때 사용합니다.

```bash
NEXT_PUBLIC_API_MODE=mock npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.
환경 변수가 없거나 `NEXT_PUBLIC_API_MODE`가 `http`가 아니면 API client는
기본적으로 mock adapter를 사용합니다.

### 실제 REST API와 연결

```bash
cp .env.example .env
npm run dev
```

`.env`의 placeholder를 실제 Supabase, GitHub OAuth와 OpenAI 값으로
교체해야 합니다. 이어서
`supabase/migrations/202608160001_initial_backend.sql`을 Supabase에
적용합니다. 설정 방법은 [환경 변수 가이드](docs/environment.md)를
따릅니다.

실제 API 모드에서는 다음 값이 필요합니다.

| 환경 변수                   | 공개 여부 | 용도                            |
| --------------------------- | --------- | ------------------------------- |
| `SUPABASE_URL`              | 서버 전용 | Supabase 프로젝트 URL           |
| `SUPABASE_SERVICE_ROLE_KEY` | 비밀      | DB와 private Storage 접근       |
| `GITHUB_CLIENT_ID`          | 서버 전용 | GitHub OAuth App                |
| `GITHUB_CLIENT_SECRET`      | 비밀      | GitHub OAuth App                |
| `GITHUB_OAUTH_REDIRECT_URI` | 서버 전용 | OAuth callback URL              |
| `TOKEN_ENCRYPTION_KEY`      | 비밀      | GitHub token AES-GCM 암호화     |
| `OPENAI_API_KEY`            | 비밀      | 포트폴리오 콘텐츠 생성          |
| `OPENAI_MODEL`              | 서버 전용 | 생성 모델 선택                  |
| `NEXT_PUBLIC_API_MODE`      | 공개      | `mock` 또는 `http` adapter 선택 |

비밀값은 브라우저 코드나 `NEXT_PUBLIC_` 변수에 넣지 않으며 `.env*` 파일은
커밋하지 않습니다.

## 주요 명령어

```bash
npm run dev       # Webpack 기반 로컬 개발 서버
npm run lint      # ESLint 정적 검사
npm run build     # 타입 검사와 프로덕션 빌드
npm test          # 빌드 후 기본 렌더링 검사
npm start         # 프로덕션 서버 실행
```

## 아키텍처

```text
페이지·컴포넌트
    ↓
lib/api-client의 공통 인터페이스
    ├─ mock adapter → mocks/api fixture
    └─ HTTP adapter → app/api/v1 Route Handler
                         ↓
                     server service
                         ├─ Supabase Postgres·Storage
                         ├─ GitHub API
                         └─ Vercel Workflow → OpenAI API
```

페이지는 mock 또는 HTTP adapter를 직접 알지 않습니다. 두 adapter는
`contracts/api-contract.ts`의 같은 DTO를 반환하므로 실제 API 연결 시 화면
코드 대신 `NEXT_PUBLIC_API_MODE`만 변경합니다. 모든 REST 성공 응답은
`{ data, meta }`, 실패 응답은 `{ error }` envelope를 사용합니다.

## 폴더 구조

```text
app/                  페이지, 레이아웃과 REST Route Handler
components/           공통 UI와 포트폴리오 컴포넌트
contracts/            프론트·백 공용 API DTO
lib/api-client/       UI용 API interface와 mock·HTTP adapter
mocks/api/            계약을 만족하는 프론트 mock 데이터
server/               인증, 도메인 서비스와 외부 연동
supabase/migrations/  Postgres와 Storage 초기 스키마
workflows/            장시간 포트폴리오 생성 Workflow
tests/                API, 프롬프트와 렌더링 테스트
docs/                 계약, 환경, 정책과 역할별 작업 기록
```

## MVP 범위와 현재 제약

- 로그인 제공자는 GitHub 하나로 고정합니다.
- 신규 잔액은 100크레딧, 저장소당 예상 비용은 30크레딧이지만 실제로
  차감하지 않습니다.
- 결제 API와 화면은 mock이며 외부 결제 승인이나 잔액 지급을 하지 않습니다.
- 저장소 다중 선택 UI는 제공하지만 실제 HTTP 생성 계약은 대표
  `repositoryId` 하나를 사용합니다. 다중 저장소 분석은 후속 계약입니다.
- 포트폴리오 결과는 하나의 고정 스타일을 사용하며 사용자 편집 기능은
  MVP 이후 범위입니다.
- 실제 인증·생성·PDF 흐름을 확인하려면 Supabase migration, GitHub OAuth와
  OpenAI 환경 변수가 모두 준비되어야 합니다.

## 협업과 문서

- [아키텍처](architecture.md): 화면, 사용자 흐름과 시스템 경계의 기준
- [에이전트 협업 정책](AGENTS.md): 파일 소유권, mock 우선 연동과 Git 규칙
- [REST API 계약](docs/api-contract.md): endpoint, DTO와 오류 응답
- [환경 변수 가이드](docs/environment.md): 로컬·Vercel 설정
- [커밋 정책](docs/commit-policy.md): 한글 Conventional Commits 규칙
- [통합 작업 로그](docs/work-log.md): 공통 정책과 통합 작업
- [프론트엔드 로그](docs/frontend-work-log.md): 화면과 API client 작업
- [백엔드 로그](docs/backend-work-log.md): API, DB와 Workflow 작업
- [Codex 대화 이력](docs/codex-chat-history.md): 이번 MVP 작업의 요청·결정 요약

프론트엔드와 백엔드는 `develop`에서 통합하며 `main`은 Vercel Production,
`develop`은 Preview 배포 기준입니다. 공유 파일과 Git 작업은 통합 담당자가
직렬로 처리하고 `develop`에는 force push하지 않습니다.
