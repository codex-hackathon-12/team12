# 취업 포트폴리오 AI

codex hackathon 12팀의 MVP 프로젝트입니다. Git 저장소와 사용자 입력을 바탕으로 취업용 포트폴리오와 이력서 초안을 만드는 서비스를 목표로 합니다.

## 개발 환경

- Node.js 22.13 이상
- React 19
- Next.js 16 App Router
- TypeScript strict mode
- Tailwind CSS 4
- Vercel 배포와 Vercel Workflow
- Supabase Postgres와 Storage

## 시작하기

```bash
nvm install
nvm use
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 주요 명령어

```bash
npm run dev          # 로컬 개발 서버
npm run build        # 프로덕션 빌드 확인
npm run lint         # 정적 검사
npm test             # 빌드 후 tests/ 전체 실행
```

## 폴더 구조

```text
app/                  페이지, 레이아웃, API 라우트
server/               서버 비즈니스 로직과 외부 연동
workflows/            Vercel Workflow 정의
supabase/             Postgres·Storage 마이그레이션
public/               정적 파일
tests/                단위 테스트와 렌더링 검사
```

`main`은 Vercel Production 배포, `develop`은 Preview 배포에 사용한다. 배포 환경 변수와
GitHub OAuth callback 설정은 `docs/environment.md`를 따른다.
