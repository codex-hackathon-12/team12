# 환경 변수 설정

## 1. 로컬 파일 만들기

`.env.example`을 복사해 로컬 전용 `.env` 파일을 만든다.

```bash
cp .env.example .env
```

`.env`은 Git에서 무시된다. 실제 key, token, Supabase URL을 커밋하지 않는다.

## 2. Supabase

Supabase Dashboard의 **Project Settings > API**에서 값을 확인한다.

| 변수 | 값 | 사용처 |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL | Postgres와 Storage server client |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | 서버 전용 DB와 private Storage 접근 |

`SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하므로 브라우저, 프론트엔드 코드,
`NEXT_PUBLIC_` 변수에 넣지 않는다.

Supabase SQL Editor 또는 CLI에서 `supabase/migrations/202608160001_initial_backend.sql`을
실행해 테이블과 private `resumes` bucket을 만든다.

## 3. GitHub OAuth

GitHub의 **Settings > Developer settings > OAuth Apps**에서 OAuth App을 만든다.

| 항목 | 로컬 값 |
| --- | --- |
| Homepage URL | `http://localhost:5173` |
| Authorization callback URL | `http://localhost:5173/api/v1/auth/github/callback` |

OAuth App의 Client ID와 Client Secret을 각각 `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`에 설정한다. 배포 시 `GITHUB_OAUTH_REDIRECT_URI`와 GitHub
callback URL을 실제 서비스 도메인으로 함께 변경한다.

서버는 private repository 분석을 위해 `read:user`, `user:email`, `repo`, `read:org`
권한을 요청한다.

## 4. 암호화 키

GitHub access token을 AES-GCM으로 암호화한다. 아래 명령으로 만든 값을
`TOKEN_ENCRYPTION_KEY`에 넣는다.

```bash
openssl rand -base64 32
```

키를 바꾸면 기존에 저장된 GitHub token을 복호화할 수 없다. 운영에서는 Cloudflare
secret으로만 관리한다.

## 5. Cloudflare와 OpenAI

`GENERATION_WORKFLOW`는 환경변수가 아니라 Cloudflare Workflow binding이다.
실제 생성 기능을 배포하기 전에 Worker에 binding을 추가해야 한다.

`OPENAI_API_KEY`와 `OPENAI_MODEL`은 생성 Workflow가 OpenAI Responses API를 호출할 때 사용한다.
기본 모델은 `gpt-5.6-luna`이며, 생성 결과는 한국어 strict JSON schema로 검증한다.
현재 생성 API는 Workflow binding이 없으면 실패 상태를 기록한다.
