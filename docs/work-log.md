# 통합 작업 로그

이 문서는 아키텍처, API 계약, 협업 정책, Git 동기화와 프론트·백엔드
통합 검증처럼 역할 경계를 넘는 공통 작업만 기록한다. 통합 담당자만
수정하며 최신 항목을 위에 추가한다.

역할별 구현 기록과 이전 통합 기록은 다음 문서에서 확인한다.

- 프론트엔드: `docs/frontend-work-log.md`
- 백엔드: `docs/backend-work-log.md`
- 역할 분리 이전 보관본: `docs/work-log-archive.md`

## 2026-09-04-06 — 되묻기 계약과 분량 규격 정정

- 상태: 완료
- 정제된 요청: 지원자에게 되묻는 흐름을 계약과 아키텍처에 반영하고, 문서와
  구현이 어긋난 분량 규격을 맞춘다.
- 확인 결과:
  - `architecture.md` §6.6과 `PortfolioContentDto` 주석이 구현보다 좁은
    값을 말하고 있었다. headline 60자·highlights 3개로 적혀 있었지만
    지시문·JSON schema·자르기 세 곳은 80자·4개로 서로 일치했다.
  - 활자 표가 `--text-*`를 가리켰으나 문서 활자는 `--doc-*`로 분리됐다.
  - 서버가 쓰는 입력 상한이 계약에 없어 화면이 알 수 없었다.
- 결정사항:
  - 구현 세 곳이 합의하고 문서만 낡은 것이므로 문서를 구현에 맞춘다.
  - 되묻기 반영은 새 생성 작업이 아니라 별도 endpoint로 둔다. 활성 작업
    1개 제한과 무관하고 크레딧도 쓰지 않는다.
  - 응답이 `updatedFields`를 돌려줘, 답한 자리만 바뀐다는 약속을 계약이
    명시한다. 이 약속은 프롬프트가 아니라 서버 병합 단계가 지킨다.
  - 답변 상한을 `PORTFOLIO_ANSWER_MAX_LENGTH`로 내보낸다. 상한이 계약에
    없으면 화면이 모르고 서버가 조용히 자르거나 거절한다.
- 반영 내용:
  - `architecture.md` §6.6에 되묻기 절과 `PortfolioStatement` 모델을 넣고,
    분량·활자 표를 정정했다.
  - 계약에 `PortfolioQuestionDto`, `PortfolioStatementResultDto`,
    `GENERATION_INPUT_LIMITS`, `EVIDENCE_UNAVAILABLE`을 추가했다.
  - `docs/api-contract.md` §8.3에 요청·응답과 오류 표를 추가하고 이후 절
    번호를 밀었다.
  - 마이그레이션 `202609030001`을 운영에 적용했다. dry-run으로 대상이 신규
    1건뿐임을 확인한 뒤 push했고, 적용 후 원격 이력과 테이블 존재를 확인했다.
- 수정 파일: `architecture.md`, `contracts/api-contract.ts`,
  `docs/api-contract.md`, `docs/work-log.md`
- 검증: 계약 변경 커밋 단독으로도 `tsc`가 통과하도록 필수 필드의 빈 배열
  기본값을 같은 커밋에 포함했다. 이후 전체 테스트 200건과 build를 확인했다.
- 남은 항목: 없음.

## 2026-08-16-05 — 최종 프로젝트 문서와 대화 이력 정리

- 상태: 완료
- 정제된 요청: 처음 프로젝트를 접하는 사람이 제품 목적, 실행 방법과 현재
  MVP 제약을 한 문서에서 이해할 수 있도록 README를 완성하고, 프로젝트 진행
  중 Codex에 전달한 요청과 결정 과정을 별도 Markdown 문서로 보존한다.
- 제약조건:
  - 실제 구현, `architecture.md`, API 계약과 환경 변수 가이드를 기준으로 한다.
  - 대화 원문이나 내부 추론 대신 요청, 결정, 결과와 후속 과제를 정리한다.
  - 비밀 키, OAuth token, cookie와 개인 로컬 경로를 기록하지 않는다.
- 반영 내용:
  - README에 기능, 사용자 흐름, 라우트, 기술 스택, mock·HTTP 실행 방법,
    환경 변수, 시스템 레이어, MVP 제약과 협업 문서를 통합했다.
  - `docs/codex-chat-history.md`에 기획부터 퍼블리싱, REST 연결, 녹화 브랜치와
    결과 디자인까지의 대화 결정을 시간순으로 기록했다.
  - 실제 OAuth end-to-end, 다중 저장소 계약과 결과 데이터 QA를 후속 항목으로
    분리했다.
- 수정 파일: `README.md`, `docs/codex-chat-history.md`,
  `docs/work-log.md`
- 검증: 문서 링크, 구현 경로, 환경 변수명, commit hash와 Markdown 공백을
  저장소 기준으로 확인했다.
- 남은 항목: 없음.

## 2026-08-16-04 — 원격 develop 재통합과 잠금 파일 복구

- 상태: 완료
- 정제된 요청: 원격 `develop` 변경을 로컬 프론트엔드 커밋과 통합하고,
  충돌 또는 빌드 설정 불일치가 있으면 해결한 뒤 커밋 가능한 상태로 만든다.
- 확인 결과:
  - 원격 3개 커밋 위로 로컬 2개 커밋이 충돌 없이 rebase됐다.
  - 원격 Vercel·Next.js 전환 커밋의 `package.json`과 `package-lock.json`이
    일치하지 않아 `npm ci`가 누락 의존성 오류로 중단됐다.
- 반영 내용:
  - `npm install`로 누락된 Next.js 전환 의존성을 잠금 파일에 반영했다.
  - 기존 vinext 개발 서버를 종료하고 Next.js 기준으로 전체 검증했다.
- 수정 파일: `package-lock.json`, `docs/work-log.md`
- 검증:
  - ESLint와 Next.js production build를 통과했다.
  - 렌더링 정책 테스트 1건은 통과했고, 로컬 TCP listener가 필요한 1건은
    sandbox 제약에 따라 테스트 자체의 명시적 skip 조건으로 처리됐다.
- 남은 항목: `npm install`이 보고한 패키지 보안 경고는 별도 범위에서
  영향도와 호환성을 검토한다.

## 2026-08-16-03 — 로그인 사용자 랜딩 접근 정책 확정

- 상태: 완료
- 정제된 요청: 공개 랜딩은 비로그인 사용자에게만 제공하고, 로그인된
  사용자가 루트 경로에 접근하면 개인 대시보드로 바로 이동시킨다.
- 결정사항:
  - `/` 진입 시 공통 API client로 GitHub 로그인 세션을 먼저 확인한다.
  - 인증된 세션은 `/dashboard`로 교체 이동하고 랜딩을 렌더링하지 않는다.
  - 비로그인 랜딩의 상단과 hero CTA는 GitHub 로그인 의미로 통일한다.
- 반영 내용:
  - 공개 랜딩 접근 정책을 `architecture.md`에 명시했다.
  - 세션 확인 중에는 로딩 상태를 표시하고 인증 여부가 확인된 뒤에만
    랜딩 또는 대시보드 이동을 결정하도록 구현했다.
  - 렌더링 테스트의 랜딩 접근 정책 검사를 새 기준에 맞췄다.
- 수정 파일: `architecture.md`, `app/page.tsx`,
  `tests/rendered-html.test.mjs`, `docs/work-log.md`
- 검증: ESLint, Node.js 22.13 production build와 렌더링 테스트 2건을
  모두 통과했다.
- 남은 항목: 없음.

## 2026-08-16-02 — 공개 랜딩과 생성 선택 흐름 조정

- 상태: 완료
- 정제된 요청: 로그인 전 서비스 소개를 공개 랜딩으로 분리하고 로그인
  대시보드와 포트폴리오 생성 선택 흐름의 책임을 명확히 한다.
- 결정사항:
  - `/`는 공개 hero와 정적 맛보기, `/dashboard`는 로그인 작업 공간이다.
  - 저장소 선택 UI는 하나 이상을 지원하지만, 실제 다중 저장소 분석은
    `repositoryIds` 계약과 백엔드 저장 모델 합의 후 연결한다.
  - 현재 HTTP adapter는 단일 `repositoryId` 계약을 유지하며 mock에서만
    다중 선택 흐름을 시연한다.
  - 결과 포트폴리오의 새 디자인은 소유자 결과 페이지에만 적용하고 공개
    갤러리에는 영향을 주지 않는다.
- 반영 내용:
  - 랜딩, 대시보드, 저장소 선택, 결과와 결제 페이지 책임을 아키텍처에
    갱신했다.
  - 이전 `/` redirect를 전제로 한 렌더링 테스트를 공개 랜딩 기준으로 바꿨다.
- 수정 파일: `architecture.md`, `tests/rendered-html.test.mjs`,
  `docs/work-log.md`
- 검증: 아키텍처와 구현 경로의 일치, 전체 build와 렌더링 테스트를 확인했다.
- 남은 항목: 백엔드 다중 저장소 생성 계약을 별도 합의한다.

## 2026-08-16-01 — 역할별 작업 로그 분리

- 상태: 완료
- 정제된 요청: 프론트엔드와 백엔드가 같은 작업 로그의 최상단을 동시에
  수정해 발생하는 반복 충돌을 제거한다.
- 제약조건:
  - 기존 작업 기록을 삭제하거나 덮어쓰지 않는다.
  - 각 담당자는 자신의 역할 로그만 수정한다.
  - 정책, 계약과 Git 통합 기록은 구현 로그와 분리한다.
- 결정사항:
  - 프론트엔드는 `docs/frontend-work-log.md`만 수정한다.
  - 백엔드는 `docs/backend-work-log.md`만 수정한다.
  - 통합 담당자는 공통 작업을 `docs/work-log.md`에 기록한다.
  - 역할 분리 이전 전체 기록은 `docs/work-log-archive.md`를 읽기 전용
    보관본으로 유지한다.
- 반영 내용:
  - 기존 프론트엔드와 백엔드 기록을 역할별 로그로 복사해 보존했다.
  - 역할별 수정 가능·금지 경로와 로그 작성 책임을 `AGENTS.md`에 명시했다.
  - 각 로그의 항목 번호를 파일 내부에서 독립적으로 관리하도록 정했다.
- 수정 파일: `AGENTS.md`, `docs/frontend-work-log.md`,
  `docs/backend-work-log.md`, `docs/work-log.md`,
  `docs/work-log-archive.md`
- 검증: 로그 파일별 소유권, 기존 기록 보존과 Markdown diff를 확인했다.
- 남은 항목: 없음.
