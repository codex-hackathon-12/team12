# REST API 계약

## 1. 범위

이 문서는 취업 포트폴리오 AI MVP에서 프론트엔드와 백엔드가 주고받는 데이터 형식을 정의한다. TypeScript 타입의 기준은 `contracts/api-contract.ts`다.

MVP 확정 정책:

- 로그인과 Git 저장소 연동은 GitHub OAuth만 사용한다.
- 신규 사용자의 표시 크레딧은 100이다.
- 저장소 하나를 사용한 생성의 예상 비용은 30크레딧이다.
- MVP에서는 크레딧을 실제로 차감하지 않는다.
- 결제 상품과 checkout은 mock이며 실제 승인이나 크레딧 지급이 발생하지 않는다.
- 생성 결과는 프로필, 자기소개, 기술 스택, 프로젝트, Git 분석 결과와 연락처로 구성한다.

## 2. 공통 규칙

- Base path: `/api/v1`
- Body와 일반 응답: `application/json`
- 필드명: `camelCase`
- ID: 문자열
- 날짜와 시간: ISO 8601 UTC 문자열
- 금액: 원 단위 정수인 `priceKrw`
- 선택값이 없음을 명시해야 하는 필드는 `null`을 사용한다.
- 응답에 DB 모델, GitHub access token 또는 내부 오류 원문을 노출하지 않는다.

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
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해주세요.",
    "details": {
      "fields": [
        {
          "field": "prompt",
          "reason": "한 글자 이상 입력해야 합니다."
        }
      ],
      "retryable": false,
      "requestId": "req_123"
    }
  }
}
```

기본 상태 코드:

| 상태 | 용도 |
| --- | --- |
| `200` | 조회·수정 성공 |
| `201` | 리소스 생성 성공 |
| `202` | 비동기 작업 접수 |
| `204` | 응답 body 없는 성공 |
| `400` | 형식 또는 입력 검증 오류 |
| `401` | GitHub 로그인 필요 |
| `403` | 리소스 접근 권한 없음 |
| `404` | 리소스 없음 |
| `409` | 현재 상태와 요청이 충돌 |
| `429` | GitHub 또는 생성 API 요청 제한 |
| `500` | 내부 서버 오류 |
| `502` | 외부 서비스 연동 오류 |

## 3. GitHub 인증

### 3.1 GitHub 로그인 시작

`GET /api/v1/auth/github?returnTo=/repositories`

- 브라우저 navigation으로 호출한다.
- 서버는 OAuth `state`를 생성하고 GitHub 인증 화면으로 `302` redirect한다.
- `returnTo`는 같은 origin의 상대 경로만 허용한다.
- JSON envelope를 사용하지 않는 OAuth redirect 예외다.

### 3.2 GitHub callback

`GET /api/v1/auth/github/callback?code=...&state=...`

- 서버가 `state`를 검증하고 GitHub access token을 교환한다.
- 로그인 성공 시 HttpOnly 세션 쿠키를 설정하고 `returnTo`로 redirect한다.
- access token은 서버에만 저장하고 프론트엔드에 반환하지 않는다.
- 실패 시 `/dashboard?authError=AUTH_FAILED`로 redirect한다.

### 3.3 세션 조회

`GET /api/v1/auth/session`

로그인 응답:

```json
{
  "data": {
    "authenticated": true,
    "provider": "github",
    "user": {
      "id": "user_123",
      "githubUserId": "99123",
      "username": "octocat",
      "displayName": "Octo Cat",
      "avatarUrl": "https://avatars.githubusercontent.com/u/99123",
      "profileUrl": "https://github.com/octocat",
      "email": "octocat@example.com",
      "creditBalance": 100,
      "createdAt": "2026-08-16T04:00:00.000Z"
    }
  }
}
```

비로그인 응답:

```json
{
  "data": {
    "authenticated": false,
    "provider": null,
    "user": null
  }
}
```

### 3.4 로그아웃

`POST /api/v1/auth/logout`

```json
{
  "data": {
    "loggedOut": true
  }
}
```

### 3.5 계정 삭제

`DELETE /api/v1/account`

로그인 사용자의 세션, GitHub 연결과 생성 결과를 비동기 삭제한다. 진행 중인
삭제 요청이 있으면 `409 ACCOUNT_DELETION_IN_PROGRESS`를 반환한다.

```json
{
  "data": {
    "deletionJobId": "deletion_123",
    "status": "queued"
  }
}
```

## 4. 대시보드

### 4.1 대시보드 데이터 조회

`GET /api/v1/dashboard`

대시보드 한 화면에 필요한 세션, 크레딧, 맛보기, 최근 결과와 공지를 함께 반환한다. 비로그인 사용자의 `recentPortfolios`는 빈 배열이다.

```json
{
  "data": {
    "session": {
      "authenticated": true,
      "provider": "github",
      "user": {
        "id": "user_123",
        "githubUserId": "99123",
        "username": "octocat",
        "displayName": "Octo Cat",
        "avatarUrl": "https://avatars.githubusercontent.com/u/99123",
        "profileUrl": "https://github.com/octocat",
        "email": "octocat@example.com",
        "creditBalance": 100,
        "createdAt": "2026-08-16T04:00:00.000Z"
      }
    },
    "credits": {
      "balance": 100,
      "initialBalance": 100,
      "costPerRepository": 30,
      "chargingEnabled": false,
      "isMock": true
    },
    "tasteSample": {
      "id": "sample_backend",
      "title": "백엔드 개발자 포트폴리오 예시",
      "description": "준비된 저장소와 결과를 사용하는 정적 맛보기입니다.",
      "repository": {
        "id": "sample_repo",
        "name": "sample-api",
        "fullName": "sample/sample-api",
        "description": "REST API 예시 프로젝트",
        "primaryLanguage": "TypeScript"
      },
      "prompt": "백엔드 직무에 맞춰 API 설계 경험을 강조해줘.",
      "portfolioPreview": {},
      "isStatic": true
    },
    "recentPortfolios": [],
    "announcements": []
  }
}
```

`portfolioPreview`의 전체 구조는 8장의 `PortfolioContent` 형식을 따른다.

## 5. Git 저장소

저장소 API는 로그인이 필요하다. GitHub token과 clone credential은 절대 응답하지 않는다.

### 5.1 저장소 목록

`GET /api/v1/repositories?q=api&visibility=all&cursor=...&limit=20`

Query:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `q` | `string` | 아니요 | 이름과 설명 검색 |
| `visibility` | `all \| public \| private` | 아니요 | 기본값 `all` |
| `cursor` | `string` | 아니요 | 다음 페이지 cursor |
| `limit` | `number` | 아니요 | 기본 20, 최대 50 |

```json
{
  "data": {
    "repositories": [
      {
        "id": "repo_123",
        "githubRepositoryId": "887766",
        "owner": {
          "username": "octocat",
          "avatarUrl": "https://avatars.githubusercontent.com/u/99123"
        },
        "name": "portfolio-api",
        "fullName": "octocat/portfolio-api",
        "description": "취업 포트폴리오 생성 API",
        "htmlUrl": "https://github.com/octocat/portfolio-api",
        "defaultBranch": "main",
        "primaryLanguage": "TypeScript",
        "visibility": "private",
        "starCount": 3,
        "forkCount": 1,
        "pushedAt": "2026-08-15T12:30:00.000Z",
        "syncedAt": "2026-08-16T04:00:00.000Z"
      }
    ]
  },
  "meta": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### 5.2 저장소 동기화

`POST /api/v1/repositories/sync`

Request body는 없다.

```json
{
  "data": {
    "repositories": [],
    "syncedAt": "2026-08-16T04:00:00.000Z"
  }
}
```

### 5.3 저장소 상세

`GET /api/v1/repositories/{repositoryId}`

응답의 `data`는 저장소 목록의 `GitRepository` 한 건과 동일하다. 요청 사용자에게 속하지 않은 저장소는 존재 여부를 숨기기 위해 `404`를 반환한다.

## 6. 크레딧 견적

### 6.1 크레딧 상태 조회

`GET /api/v1/credits`

```json
{
  "data": {
    "balance": 100,
    "initialBalance": 100,
    "costPerRepository": 30,
    "chargingEnabled": false,
    "isMock": true
  }
}
```

MVP에서는 로그인 여부나 생성 횟수와 관계없이 표시 잔액을 100으로 유지한다. 생성 요청에는 다음 견적을 포함한다.

```json
{
  "currentBalance": 100,
  "repositoryCount": 1,
  "estimatedCost": 30,
  "balanceAfterGeneration": 100,
  "willCharge": false,
  "isMock": true
}
```

## 7. 포트폴리오 생성

### 7.1 생성 요청

`POST /api/v1/generations`

```json
{
  "repositoryIds": ["repo_123", "repo_456"],
  "prompt": "백엔드 직무에 맞춰 문제 해결과 성능 개선 경험을 강조해줘.",
  "targetRole": "Backend Engineer",
  "tone": "professional",
  "highlights": ["REST API 설계", "성능 개선"]
}
```

검증 규칙:

- `repositoryIds`: 필수, 1~5개, 모두 로그인 사용자 소유 저장소. 중복은 서버가 제거하고 순서는 유지한다. 5개를 넘으면 `TOO_MANY_REPOSITORIES`로 400을 반환한다. 저장소 하나가 프로젝트 하나가 된다.
- `prompt`: 필수, 공백 제거 후 1~2,000자
- `targetRole`: 선택, 최대 100자
- `tone`: `professional`, `concise`, `storytelling` 중 하나
- `highlights`: 선택, 최대 10개, 각 항목 최대 100자

서버는 요청을 접수하고 `202 Accepted`를 반환한다.

```json
{
  "data": {
    "jobId": "job_123",
    "repositoryId": "repo_123",
    "repositoryIds": ["repo_123", "repo_456"],
    "status": "queued",
    "stage": "queued",
    "progress": 0,
    "message": "생성 요청을 접수했습니다.",
    "portfolioId": null,
    "creditQuote": {
      "currentBalance": 100,
      "repositoryCount": 1,
      "estimatedCost": 30,
      "balanceAfterGeneration": 100,
      "willCharge": false,
      "isMock": true
    },
    "error": null,
    "createdAt": "2026-08-16T04:00:00.000Z",
    "updatedAt": "2026-08-16T04:00:00.000Z"
  }
}
```

### 7.2 생성 상태 조회

`GET /api/v1/generations/{jobId}`

프론트엔드는 완료 또는 실패 전까지 2초 간격으로 호출한다.

상태:

| `status` | 의미 |
| --- | --- |
| `queued` | 작업 대기 |
| `processing` | 저장소 분석 또는 콘텐츠 생성 중 |
| `completed` | 결과 생성 완료 |
| `failed` | 생성 실패 |

단계:

| `stage` | 의미 |
| --- | --- |
| `queued` | 요청 접수 |
| `analyzingRepository` | 저장소 분석 |
| `generatingContent` | 콘텐츠 생성 |
| `renderingPortfolio` | 결과 구조 생성 |
| `completed` | 완료 |
| `failed` | 실패 |

완료 응답:

```json
{
  "data": {
    "jobId": "job_123",
    "repositoryId": "repo_123",
    "repositoryIds": ["repo_123", "repo_456"],
    "status": "completed",
    "stage": "completed",
    "progress": 100,
    "message": "포트폴리오가 완성되었습니다.",
    "portfolioId": "portfolio_123",
    "creditQuote": {
      "currentBalance": 100,
      "repositoryCount": 1,
      "estimatedCost": 30,
      "balanceAfterGeneration": 100,
      "willCharge": false,
      "isMock": true
    },
    "error": null,
    "createdAt": "2026-08-16T04:00:00.000Z",
    "updatedAt": "2026-08-16T04:01:20.000Z"
  }
}
```

활성 작업이 이미 있으면 생성 요청은 `409 GENERATION_IN_PROGRESS`를 반환한다.

실패한 job도 HTTP 조회 자체는 성공했으므로 `200`을 반환하고 `data.status`를 `failed`로 설정한다.

```json
{
  "data": {
    "jobId": "job_123",
    "repositoryId": "repo_123",
    "repositoryIds": ["repo_123", "repo_456"],
    "status": "failed",
    "stage": "failed",
    "progress": 45,
    "message": "저장소 분석에 실패했습니다.",
    "portfolioId": null,
    "creditQuote": {
      "currentBalance": 100,
      "repositoryCount": 1,
      "estimatedCost": 30,
      "balanceAfterGeneration": 100,
      "willCharge": false,
      "isMock": true
    },
    "error": {
      "code": "GENERATION_FAILED",
      "message": "잠시 후 다시 시도해주세요.",
      "retryable": true
    },
    "createdAt": "2026-08-16T04:00:00.000Z",
    "updatedAt": "2026-08-16T04:00:30.000Z"
  }
}
```

### 7.3 생성 재시도

`POST /api/v1/generations/{jobId}/retry`

실패했고 재시도 가능한 job에만 허용한다. 새 job을 만들고 기존 job ID를 함께 반환한다.

```json
{
  "data": {
    "previousJobId": "job_123",
    "job": {
      "jobId": "job_124",
      "repositoryId": "repo_123",
      "repositoryIds": ["repo_123", "repo_456"],
    "repositoryIds": ["repo_123", "repo_456"],
      "status": "queued",
      "stage": "queued",
      "progress": 0,
      "message": "재시도 요청을 접수했습니다.",
      "portfolioId": null,
      "creditQuote": {
        "currentBalance": 100,
        "repositoryCount": 1,
        "estimatedCost": 30,
        "balanceAfterGeneration": 100,
        "willCharge": false,
        "isMock": true
      },
      "error": null,
      "createdAt": "2026-08-16T04:02:00.000Z",
      "updatedAt": "2026-08-16T04:02:00.000Z"
    }
  }
}
```

## 8. 포트폴리오 결과

### 8.1 결과 데이터 구조

```json
{
  "id": "portfolio_123",
  "title": "문제 해결에 집중하는 백엔드 개발자",
  "targetRole": "Backend Engineer",
  "repositoryName": "portfolio-api",
  "techStack": ["TypeScript", "Next.js", "Drizzle"],
  "createdAt": "2026-08-16T04:01:20.000Z",
  "generationJobId": "job_123",
  "repository": {
    "id": "repo_123",
    "githubRepositoryId": "887766",
    "owner": {
      "username": "octocat",
      "avatarUrl": "https://avatars.githubusercontent.com/u/99123"
    },
    "name": "portfolio-api",
    "fullName": "octocat/portfolio-api",
    "description": "취업 포트폴리오 생성 API",
    "htmlUrl": "https://github.com/octocat/portfolio-api",
    "defaultBranch": "main",
    "primaryLanguage": "TypeScript",
    "visibility": "private",
    "starCount": 3,
    "forkCount": 1,
    "pushedAt": "2026-08-15T12:30:00.000Z",
    "syncedAt": "2026-08-16T04:00:00.000Z"
  },
  "style": "default",
  "content": {
    "profile": {
      "displayName": "Octo Cat",
      "headline": "확장 가능한 API를 설계하는 개발자",
      "targetRole": "Backend Engineer",
      "avatarUrl": "https://avatars.githubusercontent.com/u/99123"
    },
    "introduction": "사용자 문제를 안정적인 API와 데이터 모델로 해결합니다.",
    "skills": [
      {
        "category": "Backend",
        "skills": ["TypeScript", "REST API", "Drizzle ORM"]
      }
    ],
    "projects": [
      {
        "id": "project_123",
        "title": "취업 포트폴리오 생성 API",
        "description": "Git 저장소 분석 결과를 포트폴리오로 변환하는 서비스입니다.",
        "repositoryUrl": "https://github.com/octocat/portfolio-api",
        "role": "Backend Engineer",
        "techStack": ["TypeScript", "Next.js", "Drizzle"],
        "highlights": ["비동기 생성 작업 설계"],
        "challenges": ["긴 생성 시간 동안 사용자 상태 유지"],
        "solutions": ["job 기반 polling API 설계"],
        "impact": ["새로고침 후에도 생성 상태 복구"]
      }
    ],
    "gitAnalysis": {
      "summary": "API와 데이터 계층을 명확히 분리한 프로젝트입니다.",
      "primaryLanguage": "TypeScript",
      "languages": [
        {
          "name": "TypeScript",
          "percentage": 82.5
        },
        {
          "name": "CSS",
          "percentage": 17.5
        }
      ],
      "starCount": 3,
      "forkCount": 1,
      "notablePatterns": ["REST Route Handler", "Repository pattern"]
    },
    "contact": {
      "githubUrl": "https://github.com/octocat",
      "email": "octocat@example.com",
      "location": null
    }
  },
  "updatedAt": "2026-08-16T04:01:20.000Z"
}
```

### 8.2 포트폴리오 상세

`GET /api/v1/portfolios/{portfolioId}`

```json
{
  "data": {
    "id": "portfolio_123",
    "title": "문제 해결에 집중하는 백엔드 개발자",
    "targetRole": "Backend Engineer",
    "repositoryName": "portfolio-api",
    "repositoryCount": 2,
    "techStack": ["TypeScript", "Next.js", "Drizzle"],
    "createdAt": "2026-08-16T04:01:20.000Z",
    "generationJobId": "job_123",
    "repository": {},
    "repositories": [{}, {}],
    "style": "default",
    "content": {},
    "updatedAt": "2026-08-16T04:01:20.000Z"
  }
}
```

`repository`와 `content`는 8.1의 전체 구조를 사용한다. 소유자만 조회할 수 있으며 다른 사용자의 결과에는 `404`를 반환한다.

`repository`는 대표(첫 번째) 저장소이고 `repositories`는 사용한 저장소 전체를
선택 순서대로 담는다. 단일 저장소로 만든 결과에서는 항목이 하나다.
`repositoryCount`는 목록 응답에서도 함께 내려간다.

### 8.3 포트폴리오 삭제

`DELETE /api/v1/portfolios/{portfolioId}`

```json
{
  "data": {
    "deletedId": "portfolio_123"
  }
}
```

소유자만 호출할 수 있고 다른 사용자의 결과에는 `404`를 반환한다. 삭제는
되돌릴 수 없다. 생성 작업 기록은 남으며 해당 작업의 `portfolioId`만 `null`이 된다.

### 8.4 포트폴리오 목록

`GET /api/v1/portfolios?cursor=...&limit=20`

```json
{
  "data": {
    "portfolios": [
      {
        "id": "portfolio_123",
        "title": "문제 해결에 집중하는 백엔드 개발자",
        "targetRole": "Backend Engineer",
        "repositoryName": "portfolio-api",
        "techStack": ["TypeScript", "Next.js", "Drizzle"],
        "createdAt": "2026-08-16T04:01:20.000Z"
      }
    ]
  },
  "meta": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

## 9. 맛보기

### 9.1 정적 맛보기 조회

`GET /api/v1/taste/sample`

맛보기는 로그인 없이 호출할 수 있으며 실제 GitHub 또는 AI API를 호출하지 않는다.

```json
{
  "data": {
    "id": "sample_backend",
    "title": "백엔드 개발자 포트폴리오 예시",
    "description": "준비된 저장소와 결과를 사용하는 정적 맛보기입니다.",
    "repository": {
      "id": "sample_repo",
      "name": "sample-api",
      "fullName": "sample/sample-api",
      "description": "REST API 예시 프로젝트",
      "primaryLanguage": "TypeScript"
    },
    "prompt": "백엔드 직무에 맞춰 API 설계 경험을 강조해줘.",
    "portfolioPreview": {},
    "isStatic": true
  }
}
```

`portfolioPreview`는 8.1의 `content`와 동일한 전체 구조를 사용한다.

## 10. Mock 결제

### 10.1 상품 목록

`GET /api/v1/billing/products`

```json
{
  "data": {
    "products": [
      {
        "id": "credit_100",
        "name": "100 크레딧",
        "description": "포트폴리오 생성을 위한 mock 상품",
        "credits": 100,
        "priceKrw": 9900,
        "isFeatured": true,
        "isMock": true
      }
    ],
    "paymentEnabled": false,
    "isMock": true
  }
}
```

### 10.2 Mock checkout

`POST /api/v1/billing/checkout`

```json
{
  "productId": "credit_100"
}
```

```json
{
  "data": {
    "checkoutId": "mock_checkout_123",
    "product": {
      "id": "credit_100",
      "name": "100 크레딧",
      "description": "포트폴리오 생성을 위한 mock 상품",
      "credits": 100,
      "priceKrw": 9900,
      "isFeatured": true,
      "isMock": true
    },
    "status": "completed",
    "redirectPath": "/billing/success",
    "creditBalanceBefore": 100,
    "creditBalanceAfter": 100,
    "balanceChanged": false,
    "isMock": true,
    "createdAt": "2026-08-16T04:00:00.000Z"
  }
}
```

프론트엔드는 `redirectPath`로 이동하되 실제 결제가 아니라는 문구를 표시한다.

### 10.3 Mock 결제 내역

`GET /api/v1/billing/payments`

```json
{
  "data": {
    "payments": [
      {
        "id": "mock_payment_123",
        "productName": "100 크레딧",
        "priceKrw": 9900,
        "credits": 100,
        "status": "mockCompleted",
        "balanceChanged": false,
        "isMock": true,
        "createdAt": "2026-08-16T04:00:00.000Z"
      }
    ]
  }
}
```

## 11. 갤러리

### 11.1 갤러리 목록

`GET /api/v1/gallery?role=Backend%20Engineer&techStack=TypeScript&cursor=...&limit=12`

```json
{
  "data": {
    "examples": [
      {
        "id": "gallery_123",
        "title": "API 중심 백엔드 포트폴리오",
        "targetRole": "Backend Engineer",
        "description": "API 설계와 성능 개선 경험을 강조한 예시입니다.",
        "thumbnailUrl": "/gallery/backend-default.webp",
        "techStack": ["TypeScript", "Next.js", "Drizzle"],
        "style": "default",
        "createdAt": "2026-08-16T04:00:00.000Z"
      }
    ]
  },
  "meta": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### 11.2 갤러리 상세

`GET /api/v1/gallery/{exampleId}`

```json
{
  "data": {
    "id": "gallery_123",
    "title": "API 중심 백엔드 포트폴리오",
    "targetRole": "Backend Engineer",
    "description": "API 설계와 성능 개선 경험을 강조한 예시입니다.",
    "thumbnailUrl": "/gallery/backend-default.webp",
    "techStack": ["TypeScript", "Next.js", "Drizzle"],
    "style": "default",
    "createdAt": "2026-08-16T04:00:00.000Z",
    "portfolio": {}
  }
}
```

`portfolio`는 8.1의 `content` 구조와 동일하다. 공개 갤러리 데이터에는 비공개 저장소 URL이나 사용자의 비공개 연락처를 포함하지 않는다.

## 12. 공지와 이벤트

### 12.1 목록

`GET /api/v1/announcements?cursor=...&limit=10`

```json
{
  "data": {
    "announcements": [
      {
        "id": "announcement_123",
        "type": "event",
        "title": "MVP 오픈 이벤트",
        "summary": "포트폴리오 AI 맛보기를 확인해보세요.",
        "publishedAt": "2026-08-16T04:00:00.000Z",
        "endsAt": "2026-08-31T14:59:59.000Z",
        "isPinned": true
      }
    ]
  },
  "meta": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

### 12.2 상세

`GET /api/v1/announcements/{announcementId}`

```json
{
  "data": {
    "id": "announcement_123",
    "type": "event",
    "title": "MVP 오픈 이벤트",
    "summary": "포트폴리오 AI 맛보기를 확인해보세요.",
    "content": "이벤트 상세 내용입니다.",
    "publishedAt": "2026-08-16T04:00:00.000Z",
    "endsAt": "2026-08-31T14:59:59.000Z",
    "isPinned": true
  }
}
```

## 13. 프론트엔드 처리 규칙

- 백엔드가 개발 중이거나 통합 승인을 받지 않았다면 실제 endpoint 대신 계약 기반 mock adapter를 사용한다.
- mock fixture는 `contracts/api-contract.ts`의 DTO를 import하고 `satisfies`로 구조를 검증한다.
- 컴포넌트는 `lib/api-client/index.ts`만 사용하고 mock fixture, `fetch` 또는 HTTP adapter를 직접 import하지 않는다.
- mock adapter와 HTTP adapter는 같은 메서드 signature와 응답 DTO를 사용한다.
- 실제 API 연결 시 컴포넌트를 변경하지 않고 adapter 선택 설정만 변경한다.
- `authenticated: false`이거나 API가 `401`을 반환하면 GitHub 로그인으로 이동한다.
- `creditBalance`, `estimatedCost`와 상품 가격은 서버 응답을 표시하고 프론트에서 별도 계산값을 저장하지 않는다.
- `chargingEnabled: false`, `willCharge: false`, `isMock: true`를 기준으로 실제 차감이 없음을 표시한다.
- 생성 화면은 `jobId`를 URL에 유지하고 `completed` 또는 `failed`까지 polling한다.
- `completed` 응답에서 `portfolioId`가 없으면 계약 오류로 처리한다.
- API 오류의 `message`는 사용자에게 표시할 수 있지만 `details.requestId`는 문의 또는 로그 확인용으로만 사용한다.
- 배열이 비어 있는 상태와 API 오류 상태를 구분한다.

권장 파일 구조:

```text
lib/api-client/
├── index.ts
├── client.ts
└── adapters/
    ├── mock/
    └── http/

mocks/api/
├── fixtures/
└── scenarios/
```

최소 mock 시나리오:

| 기능 | 필요한 시나리오 |
| --- | --- |
| 세션 | 로그인, 비로그인 |
| 저장소 | 목록, 빈 목록, GitHub 오류 |
| 생성 | 접수, 분석 중, 생성 중, 완료, 재시도 가능 실패 |
| 포트폴리오 | 결과 있음, 결과 없음 |
| 결제 | 상품 목록, mock 완료, mock 실패 |
| 갤러리 | 목록, 필터 결과 없음, 상세 |
| 공지 | 목록, 공지 없음 |

## 14. 백엔드 처리 규칙

- GitHub access token은 암호화된 서버 저장소 또는 서버 세션에만 보관한다.
- 사용자가 소유하지 않은 저장소, job과 포트폴리오는 `404`로 처리한다.
- GitHub API 응답을 그대로 반환하지 않고 계약 DTO로 변환한다.
- 생성 요청을 접수할 때 실제 크레딧을 조회하거나 차감하지 않는다.
- 모든 `CreditQuote`는 MVP 동안 `willCharge: false`, `isMock: true`를 반환한다.
- mock checkout은 결제 SDK나 외부 결제 API를 호출하지 않는다.
- 실제 AI 연결 전에는 동일한 `GenerationJob` 상태 계약을 유지하는 mock 생성기로 대체할 수 있다.
- 실제 생성에서는 Route Handler가 Supabase Postgres 작업을 만든 뒤 Vercel Workflow를 시작한다. GitHub 분석, AI 호출과 포트폴리오 저장은 Workflow에서 수행한다.
- GitHub token은 Vercel Environment Variable로 암호화한 서버 전용 값으로만 저장한다. access token, 암호화 키와 Storage object path는 API 응답과 로그에 포함하지 않는다.
- `completed` 작업은 포트폴리오 콘텐츠가 저장된 경우 반환한다. PDF는 서버에서 만들지 않으며, 결과 문서가 A4 세로 규격이라 브라우저 인쇄의 "PDF로 저장"으로 얻는다.
- 로그에는 GitHub token, 세션 쿠키, 비공개 저장소 내용과 사용자 프롬프트 전문을 남기지 않는다.
