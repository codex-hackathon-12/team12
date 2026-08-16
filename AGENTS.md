# AGENTS.md

이 문서는 저장소 전체에 적용되는 협업 규칙이다. 프론트엔드와 백엔드는 같은 `develop` 브랜치에서 작업하며, 데이터 통신은 REST API를 사용한다.

## 공통 원칙

1. 작업자는 자신에게 지정된 담당 영역의 파일만 수정한다.
2. 다른 담당자의 파일을 수정하거나 포맷팅하거나 되돌리지 않는다.
3. 기존 변경사항은 모두 다른 작업자의 작업일 수 있으므로 덮어쓰지 않는다.
4. 관계없는 리팩터링, 파일 이동, 이름 변경, 일괄 포맷팅을 하지 않는다.
5. 공유 파일 변경이 필요하면 먼저 통합 담당자에게 변경 요청을 남긴다.
6. API 계약에 없는 URL, 필드, 상태 코드, 응답 구조를 임의로 만들지 않는다.
7. 담당 영역을 넘어서는 변경이 필요하면 직접 구현하지 말고 필요한 변경사항을 보고한다.
8. 별도 지시가 없다면 작업 에이전트는 `git commit`, `git pull`, `git rebase`, `git push`를 실행하지 않는다.
9. 모든 구현은 저장소 루트의 `architecture.md`를 반드시 따라야 한다.
10. 통합 담당자는 완료한 작업을 `docs/work-log.md`에 정제된 형태로 기록한다.
11. 모든 커밋 메시지와 커밋 단위는 `docs/commit-policy.md`를 반드시 따른다.

## 아키텍처 준수 정책

`architecture.md`는 화면 구조, 라우트, 사용자 흐름, REST API, 데이터 모델과 시스템 레이어를 정의하는 단일 기준 문서다.

- 작업을 시작하기 전에 담당 범위와 관련된 `architecture.md` 내용을 먼저 확인한다.
- 페이지, 라우트, 컴포넌트, API URL, 요청·응답, 상태값, 데이터 모델과 외부 연동 흐름을 문서와 일치시킨다.
- 문서에 정의되지 않은 구조를 임의로 추가하거나 기존 구조를 다른 방식으로 변경하지 않는다.
- 구현 요청이 `architecture.md`와 충돌하면 코드를 수정하지 말고 충돌 내용과 필요한 결정을 통합 담당자에게 보고한다.
- 아키텍처 변경이 필요하면 영향 범위를 프론트엔드와 백엔드가 먼저 확인한 후 통합 담당자가 `architecture.md`를 선행 수정한다.
- 아키텍처 변경과 그에 따른 구현은 가능한 한 별도 커밋으로 나눈다.
- 긴급한 임시 구현도 문서와 다른 상태로 남기지 않는다. 필요한 경우 같은 작업 안에서 문서를 먼저 갱신한다.
- `AGENTS.md`는 협업과 파일 소유권 규칙을, `architecture.md`는 제품과 기술 구조를 정의한다. 두 문서 중 하나라도 위반하는 구현은 완료로 간주하지 않는다.

## 프론트엔드 담당 영역

프론트엔드 담당자는 화면, 사용자 상호작용, 반응형 레이아웃, 접근성, 클라이언트 상태와 API 호출 계층을 구현한다.

수정 가능 영역:

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `app/_sites-preview/**`
- `app/` 아래의 화면 라우트. 단, `app/api/**`는 제외한다.
- `components/**`
- `hooks/**`
- `public/**`
- `lib/api-client/**`
- `mocks/api/**`
- `types/frontend/**`

수정 금지 영역:

- `app/api/**`
- `server/**`
- `db/**`
- `drizzle/**`
- `drizzle.config.ts`
- `worker/**`
- `app/chatgpt-auth.ts`
- `lib/server/**`

프론트엔드 추가 규칙:

- API 호출은 컴포넌트에 흩어놓지 않고 `lib/api-client/**`에 모은다.
- 서버 응답 타입은 합의된 API 계약을 기준으로 작성한다.
- DB 스키마나 서버 내부 모델을 추측해 프론트엔드 타입으로 사용하지 않는다.
- 백엔드 API가 개발 중이거나 통합 완료로 선언되지 않았다면 프론트엔드는 반드시 mock 데이터를 사용한다.
- mock 데이터는 `contracts/api-contract.ts`의 DTO 타입을 import하고 `satisfies`로 타입 일치를 검사한다.
- mock fixture는 `mocks/api/**`에, mock adapter는 `lib/api-client/adapters/mock/**`에 둔다.
- 실제 REST 호출은 `lib/api-client/adapters/http/**`에 격리한다.
- 페이지와 컴포넌트는 mock 또는 HTTP adapter를 직접 import하지 않고 `lib/api-client/index.ts`가 제공하는 동일 인터페이스만 사용한다.
- mock에서 실제 API로 전환할 때 페이지와 컴포넌트를 수정하지 않는다. adapter 선택 설정만 변경한다.
- mock 응답은 성공뿐 아니라 빈 목록, 생성 중, 생성 실패와 인증 오류 상태도 제공한다.
- 서버 전용 모듈이나 환경변수를 클라이언트 코드에서 import하지 않는다.

## 백엔드 담당 영역

백엔드 담당자는 REST API, 입력 검증, 비즈니스 로직, 데이터베이스, 인증과 서버 오류 처리를 구현한다.

수정 가능 영역:

- `app/api/**`
- `server/**`
- `db/**`
- `drizzle/**`
- `drizzle.config.ts`
- `worker/**`
- `app/chatgpt-auth.ts`
- `lib/server/**`
- `types/backend/**`
- 사전에 합의된 API 계약 파일

수정 금지 영역:

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `app/` 아래의 화면 라우트
- `components/**`
- `hooks/**`
- `public/**`
- `lib/api-client/**`
- `mocks/api/**`

백엔드 추가 규칙:

- API는 `/api/v1` 아래에 구현한다.
- 모든 입력값은 서버에서 검증한다.
- DB 모델을 API 응답으로 직접 노출하지 않고 DTO로 변환한다.
- 비밀 키를 클라이언트에 전달하거나 `NEXT_PUBLIC_` 환경변수로 만들지 않는다.
- React 컴포넌트, 프론트엔드 상태 또는 프론트 전용 모듈을 import하지 않는다.
- API 구현 전에 요청, 응답, 오류 코드와 예시를 계약에 먼저 반영한다.

## 공유 파일

다음 파일은 프론트엔드와 백엔드가 임의로 수정하지 않는다. 변경이 필요하면 통합 담당자에게 요청하고, 한 명이 변경을 전담한다.

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `vite.config.ts`
- `eslint.config.mjs`
- `.gitignore`
- `.env*`
- `.openai/hosting.json`
- `README.md`
- `AGENTS.md`
- `architecture.md`
- `docs/commit-policy.md`
- `docs/work-log.md`
- `shared/**`
- `contracts/**`
- `docs/api-contract.md`

의존성을 추가할 때는 `package.json`과 `package-lock.json`을 반드시 같은 커밋에 포함한다.

공유 파일 변경 요청은 다음 형식을 사용한다.

```text
공유 파일 변경 요청
- 대상 파일:
- 변경 이유:
- 필요한 변경:
- 프론트/백 영향:
- 의존성 추가 여부:
```

## REST API 계약

API 계약의 기준은 다음 파일로 한다.

- `contracts/api-contract.ts`: 공유 요청·응답 DTO와 오류 타입
- `docs/api-contract.md`: 엔드포인트, 상태 코드와 요청·응답 예시

아직 파일이 없다면 백엔드 담당자가 통합 담당자와 합의한 후 생성한다. 프론트엔드는 계약 파일을 읽어 사용하고, 직접 변경하지 않는다.

공통 형식:

- 모든 API 경로는 `/api/v1`로 시작한다.
- 요청과 응답은 JSON을 사용한다.
- JSON 필드명은 `camelCase`를 사용한다.
- 날짜와 시간은 ISO 8601 UTC 문자열을 사용한다.
- ID는 문자열로 전달한다.
- 올바른 HTTP 상태 코드를 사용한다.

성공 응답:

```json
{
  "data": {},
  "meta": {}
}
```

실패 응답:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자에게 표시 가능한 메시지",
    "details": {}
  }
}
```

API 변경 순서:

1. 요청과 응답 계약을 제안한다.
2. 프론트엔드와 백엔드가 영향 범위를 확인한다.
3. 계약 파일을 별도 변경으로 반영한다.
4. 백엔드를 구현한다.
5. 프론트엔드를 연동한다.

합의된 API URL, 필드명, 상태 코드와 오류 코드는 일방적으로 변경하지 않는다.

## Mock 우선 API 연동 정책

프론트엔드와 백엔드의 병렬 작업 중에는 `contracts/api-contract.ts`를 단일 데이터 스키마로 사용한다.

1. 백엔드는 구현 전에 `contracts/api-contract.ts`와 `docs/api-contract.md`에 계약을 확정한다.
2. 프론트엔드는 확정된 계약만 읽고 동일 DTO를 만족하는 mock fixture를 작성한다.
3. 백엔드가 개발 중인 동안 프론트엔드는 실제 미완성 endpoint를 호출하지 않는다.
4. 프론트엔드 컴포넌트는 API client 인터페이스에만 의존한다.
5. 백엔드 완료 후 통합 담당자가 계약 일치와 대표 응답을 확인한다.
6. 통합 승인이 끝나면 API client의 adapter를 mock에서 HTTP로 전환한다.
7. 전환 과정에서 UI 변경이 필요하면 계약 불일치로 간주하고 먼저 원인을 확인한다.

백엔드 API 완료 조건:

- 계약에 정의된 endpoint와 HTTP method가 구현되어 있다.
- 성공, 입력 오류, 인증 오류와 리소스 없음 응답이 계약과 일치한다.
- 대표 요청·응답 검증 결과가 완료 보고에 포함되어 있다.
- 통합 담당자가 HTTP adapter 전환 가능 상태로 승인했다.

## Git과 커밋 정책

같은 작업 디렉터리와 `develop` 브랜치를 공유하므로 Git 작업은 통합 담당자 한 명이 직렬로 수행한다.

일반 작업 에이전트:

- 코드 수정과 검증만 수행한다.
- `git add`, `git commit`, `git pull`, `git rebase`, `git push`를 실행하지 않는다.
- 다른 작업자의 변경을 stash, restore, checkout 또는 reset하지 않는다.
- 완료 후 수정 파일 목록을 통합 담당자에게 전달한다.

통합 담당자:

1. 분업 시작 전에 초기 설정을 `develop` 브랜치에 기준 커밋으로 남긴다.
2. `git status`와 diff를 확인해 담당 영역 밖의 변경이 섞이지 않았는지 검사한다.
3. `git add .` 또는 `git add -A`를 사용하지 않고 파일 경로를 명시해 stage한다.
4. 프론트엔드와 백엔드 변경을 가능한 한 별도 커밋으로 만든다.
5. push 직전에 `origin/develop`을 rebase 방식으로 동기화한다.
6. 충돌이 담당자 소유 파일에서 발생하면 임의로 해결하지 않고 담당자에게 확인한다.
7. `develop`에 force push하지 않는다.
8. 다른 작업자의 커밋을 합의 없이 amend, revert 또는 squash하지 않는다.

커밋 메시지는 `docs/commit-policy.md`에 정의된 한글 Conventional Commits 형식을 사용한다. Header는 50자 이내, Body의 각 행은 72자 이내로 작성하며 무엇을 왜 변경했는지 설명한다.

```text
feat(frontend): 포트폴리오 생성 화면 추가
feat(api): 포트폴리오 생성 API 추가
fix(frontend): API 오류 상태 처리
fix(api): 저장소 주소 검증
docs(contract): 포트폴리오 응답 계약 명시
chore(config): 공유 설정 정리
```

통합 담당자의 기본 동기화 순서:

```bash
git fetch origin
git switch develop
git pull --rebase origin develop

# 담당 영역별 파일만 명시적으로 stage하고 commit한다.

git pull --rebase origin develop
git push origin develop
```

금지 명령과 행위:

- `git push --force`
- `git push --force-with-lease`
- `git reset --hard`
- 다른 담당자 파일에 대한 `git checkout --` 또는 `git restore`
- 충돌 파일을 확인 없이 한쪽 버전으로 덮어쓰기

## 검증 원칙

- 변경 범위에 맞는 최소 검증을 수행한다.
- 프론트엔드는 주요 화면 상태, API 로딩·성공·실패 상태와 반응형 동작을 확인한다.
- 백엔드는 정상 요청, 입력 오류, 리소스 없음과 서버 오류 응답을 확인한다.
- 공유 설정이나 타입을 변경했다면 전체 빌드를 확인한다.
- 실패한 검증을 숨기지 않고 완료 보고에 원인과 함께 기록한다.

## 작업 로그 정책

`docs/work-log.md`는 사용자의 요청과 실제 반영 내용을 추적하는 상세 작업 기록이다. 충돌 방지를 위해 통합 담당자만 작업이 끝난 뒤 갱신한다.

- 사용자 요청 원문을 그대로 복사하지 않고 의도와 범위를 명확한 문장으로 정제한다.
- 정제된 요청에는 목표, 제약조건과 완료 기준을 포함한다.
- 작업 단위마다 날짜, 상태, 결정사항, 수정 파일, 검증 결과와 남은 항목을 기록한다.
- 구현하지 않은 내용이나 실패한 검증을 완료로 기록하지 않는다.
- API 또는 아키텍처 결정이 바뀌면 이전 기록을 삭제하지 않고 새 항목에 변경 이유를 남긴다.
- 토큰, 쿠키, 사용자 개인정보, 비공개 저장소 내용과 프롬프트 전문은 기록하지 않는다.
- 일반 작업 에이전트는 로그 파일을 직접 수정하지 않고 완료 보고만 전달한다.

로그 항목 형식:

```text
## YYYY-MM-DD-NN — 작업 제목
- 상태:
- 정제된 요청:
- 제약조건:
- 결정사항:
- 반영 내용:
- 수정 파일:
- 검증:
- 남은 항목:
```

## 완료 보고 형식

작업을 마치면 다음 형식으로 통합 담당자에게 보고한다.

```text
담당 영역:
구현 내용:
수정한 파일:
사용하거나 추가 요청한 API:
검증 방법과 결과:
남은 작업:
통합 담당자가 확인할 사항:
```
