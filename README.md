# 취업 포트폴리오 AI

codex hackathon 12팀의 MVP 프로젝트입니다. Git 저장소와 사용자 입력을 바탕으로 취업용 포트폴리오와 이력서 초안을 만드는 서비스를 목표로 합니다.

## 개발 환경

- Node.js 22.13 이상
- React 19
- Next.js App Router 호환 구조(vinext)
- TypeScript strict mode
- Tailwind CSS 4
- Cloudflare Sites 배포 설정
- Drizzle ORM 및 D1 확장 기반

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
npm test             # 빌드 및 기본 렌더링 검사
npm run db:generate  # Drizzle 마이그레이션 생성
```

## 폴더 구조

```text
app/                  페이지, 레이아웃, API 라우트
db/                   Drizzle 스키마와 DB 연결
drizzle/              생성된 마이그레이션
public/               정적 파일
tests/                렌더링 테스트
worker/               Cloudflare Worker 진입점
.openai/hosting.json  배포 리소스 선언
```

현재는 초기 설정과 기본 로딩 화면만 포함합니다. 제품 화면과 Git 연동, AI 생성, 크레딧 기능은 다음 구현 단계에서 추가합니다.
