# 통합 작업 로그

이 문서는 아키텍처, API 계약, 협업 정책, Git 동기화와 프론트·백엔드
통합 검증처럼 역할 경계를 넘는 공통 작업만 기록한다. 통합 담당자만
수정하며 최신 항목을 위에 추가한다.

역할별 구현 기록과 이전 통합 기록은 다음 문서에서 확인한다.

- 프론트엔드: `docs/frontend-work-log.md`
- 백엔드: `docs/backend-work-log.md`
- 역할 분리 이전 보관본: `docs/work-log-archive.md`

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
