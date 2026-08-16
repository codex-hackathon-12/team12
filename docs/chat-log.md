# 작업 대화 로그

> 작성일: 2026-08-16
> 범위: Git 연동, 백엔드·Supabase 설정, 생성 오류 수정, 배포 OAuth 설정
> 보안: access token, client secret, service role key 등 비밀값은 기록하지 않는다.

## 1. 저장소 연결과 브랜치

**사용자**: 조직 레포지토리를 clone한 뒤 `develop` 브랜치까지 정상적으로
받았는지 확인을 요청했다.

**정리된 결과**

- 기존 디렉터리에서 `git init`을 다시 할 필요는 없다.
- 조직 저장소는 별도 디렉터리로 clone하고, 그 디렉터리에서 작업한다.
- 원격 브랜치 확인 후 아래 순서로 `develop`을 사용한다.

```bash
git fetch --all
git branch -r
git switch develop
```

- 기본 작업 브랜치는 `develop`, 배포 기준 브랜치는 `main`으로 정했다.

## 2. 역할 분리와 백엔드 원칙

**사용자**: 백엔드 개발을 담당하며, 프론트엔드와 충돌을 최소화하는 방법을
요청했다.

**합의된 원칙**

- 백엔드는 `app/api/**`, `server/**`, Supabase migration, 백엔드 작업 로그만 수정한다.
- 프론트엔드 화면·컴포넌트·`lib/api-client/**`는 수정하지 않는다.
- 기능 단위로 `pull → 구현 → 검증 → 명시적 파일 stage → commit → pull --rebase → push`를 수행한다.
- API 계약이 바뀌면 프론트 담당과 먼저 합의한다.

## 3. 기술 구조 결정

**사용자**: Next.js 기반 서비스의 데이터베이스와 OAuth 구조를 요청했다.

**결정 사항**

- Next.js Route Handler를 REST API 백엔드로 사용한다.
- GitHub OAuth는 서버에서 처리하고 세션 쿠키로 로그인 상태를 유지한다.
- GitHub 저장소, 활동 요약, 생성 작업, 포트폴리오, 세션은 Supabase Postgres에 저장한다.
- GitHub access token은 AES-GCM으로 암호화해 서버에서만 저장·사용한다.
- 이력서 PDF는 Supabase Storage의 private bucket에 저장하고, 소유자 검증 API로만 제공한다.
- OpenAI 생성은 Vercel Workflow에서 비동기로 처리한다.

## 4. 로컬 개발 환경

**사용자**: `npm run dev` 실행 중 Node.js 오류를 공유했다.

**원인과 결과**

- 프로젝트 의존성은 Node.js `>=22`를 요구한다.
- Node.js 20에서는 `node:fs/promises`의 `glob` export 오류가 발생한다.
- Node.js 22 이상으로 전환한 뒤 `npm install`, `npm run dev`를 실행한다.
- 이미 실행 중인 개발 서버가 있으면 새 서버를 다시 띄우지 않고
  `http://localhost:3000`을 사용하거나 기존 PID를 종료한다.

## 5. Supabase 초기 스키마와 GitHub 로그인

**사용자**: GitHub 로그인 문제 해결을 위해 Supabase SQL Editor에서 초기 migration을
실행했다.

**발생한 문제**

```text
ERROR: must be owner of table objects
```

**원인과 조치**

- `storage.objects`는 Supabase가 관리하는 테이블이므로 프로젝트 SQL Editor에서
  `alter table storage.objects enable row level security`를 실행할 권한이 없다.
- 해당 줄을 초기 migration에서 제거했다.
- 이후 migration을 SQL Editor에서 다시 실행해 `users`, `sessions`,
  `github_connections` 등 필요한 테이블이 생성된 것을 확인했다.

**관련 커밋**

```text
3d00f64 fix(db): Supabase 초기 스키마 권한 오류 제거
```

## 6. 포트폴리오 생성 404 오류

**사용자**: 저장소 선택은 되지만 “이 내용으로 포트폴리오 만들기”를 누르면
`저장소를 찾을 수 없습니다.`라는 404가 발생하고, 백그라운드 작업만 실행되는
현상을 공유했다.

**조사 결과**

- 저장소와 로그인 사용자 소유 관계는 Supabase에서 정상이었다.
- 실제 생성 작업과 Workflow는 시작되고 있었다.
- `generation_jobs`와 `portfolios` 사이에 두 개의 FK 관계가 있어,
  `portfolios(resume_pdf_path)` 조인이 `PGRST201` 오류를 냈다.
- 생성 후 상태를 다시 읽는 단계가 오류를 `null`로 숨겼고, API가 이를
  잘못된 “저장소 없음” 404로 응답했다.

**수정 내용**

- 명시 FK 조인으로 변경했다.

```text
portfolio:portfolios!generation_jobs_portfolio_id_fkey(resume_pdf_path)
```

- 생성 작업 조회 오류는 더 이상 `null`로 숨기지 않고 서버 오류로 처리한다.
- 저장소 조회 오류도 실제 미존재와 분리해 구조화 로그에 남긴다.
- 프론트엔드 코드는 수정하지 않았다.

**검증**

- Supabase 읽기 전용 조회로 명시 조인이 정상 동작하는 것을 확인했다.
- 변경 파일 ESLint와 `git diff --check`를 통과했다.

**관련 커밋**

```text
49c0d33 fix(api): 생성 작업 조회 관계 모호성 방지
```

## 7. 다중 저장소 생성 범위

**사용자**: 여러 저장소를 선택했을 때 생성되지 않는 문제를 문의했다.

**현재 상태**

- 현재 HTTP 프론트엔드는 다중 저장소 요청을 의도적으로 차단한다.
- 현재 API 계약도 `repositoryId` 하나만 받는다.
- 따라서 프론트엔드 코드를 수정하지 않는 조건에서는 다중 저장소 생성 UI를
  활성화할 수 없다.

**후속 작업 시 필요 사항**

1. 계약을 `repositoryIds: string[]`으로 확장한다.
2. 생성 작업과 분석 데이터 모델의 다중 저장소 연결 방식을 정한다.
3. 백엔드에서 여러 저장소의 GitHub 근거를 수집·통합한다.
4. 프론트 API adapter와 생성 화면을 계약에 맞게 연결한다.

## 8. Toss Payments 작업 보류

**사용자**: Toss Payments 연동 계획과 일부 구현을 시작했지만, 우선순위를
변경해 중단을 요청했다.

**처리 결과**

- Toss 관련 미완성 파일과 환경 변수 변경은 커밋 및 배포에 포함하지 않았다.
- 이후 생성 오류 수정 커밋과 `main` 병합에도 Toss 변경을 제외했다.

## 9. Git 반영 상태

**사용자**: 수정 완료 후 `develop` push 및 `main` 병합을 요청했다.

**완료 결과**

```text
develop: 49c0d33 fix(api): 생성 작업 조회 관계 모호성 방지
main:    63db8a6 merge: develop 생성 오류 수정 반영
```

- `origin/develop` 푸시를 완료했다.
- 최신 `main`에 `develop`을 병합하고 `origin/main`에 푸시했다.
- 중단된 Toss 작업 파일은 로컬 작업 트리에 보존했다.

## 10. 운영 도메인 GitHub OAuth 설정

**사용자**: 운영 도메인 `https://folio.klr.kr/`에 맞춘 GitHub OAuth 설정을 요청했다.

**GitHub OAuth App 설정**

| 항목 | 값 |
| --- | --- |
| Homepage URL | `https://folio.klr.kr` |
| Authorization callback URL | `https://folio.klr.kr/api/v1/auth/github/callback` |

**Vercel Production 환경 변수**

```dotenv
GITHUB_CLIENT_ID=운영_GitHub_OAuth_Client_ID
GITHUB_CLIENT_SECRET=운영_GitHub_OAuth_Client_Secret
GITHUB_OAUTH_REDIRECT_URI=https://folio.klr.kr/api/v1/auth/github/callback
NEXT_PUBLIC_API_MODE=http
```

- 로컬 OAuth와 운영 OAuth는 callback URL 충돌을 피하기 위해 별도 OAuth App 사용을 권장한다.
- 환경 변수 저장 후 Vercel에서 최신 `main` 배포를 다시 실행한다.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`,
  `OPENAI_API_KEY`도 Production 환경에 설정돼 있어야 한다.

## 현재 체크리스트

- [x] Supabase 초기 스키마 생성
- [x] GitHub OAuth 서버 구현
- [x] 단일 저장소 포트폴리오 생성 오류 수정
- [x] 생성 오류 수정 `develop` push 및 `main` 병합
- [ ] 운영 도메인용 GitHub OAuth App 생성 및 Vercel 환경 변수 입력
- [ ] 운영 도메인에서 GitHub 로그인과 생성 흐름 확인
- [ ] 다중 저장소 생성 계약·백엔드·프론트 연동
- [ ] Toss Payments 작업 재개 여부 결정
