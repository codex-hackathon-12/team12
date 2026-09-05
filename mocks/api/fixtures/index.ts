import type {
  AnnouncementDto,
  AnnouncementSummaryDto,
  AuthSessionDto,
  GitHubConnectionDto,
  BillingProductDto,
  CreditSummaryDto,
  DashboardDto,
  GalleryExampleDto,
  GalleryExampleSummaryDto,
  GitRepositoryDto,
  MockPaymentDto,
  PortfolioContentDto,
  PortfolioDto,
  PortfolioQuestionDto,
  PortfolioSummaryDto,
  TasteSampleDto,
} from "@/contracts/api-contract";
import { MOCK_NOTE } from "@/lib/copy";
import { REQUESTED_SCOPES } from "@/lib/scopes";

const now = "2026-08-16T04:00:00.000Z";

export const mockSession = {
  authenticated: true,
  provider: "github",
  user: {
    id: "user_demo",
    githubUserId: "120026",
    username: "frontend-builder",
    displayName: "김코드",
    avatarUrl: "https://avatars.githubusercontent.com/u/9919",
    profileUrl: "https://github.com/frontend-builder",
    email: "hello@example.com",
    creditBalance: 100,
    createdAt: now,
  },
} satisfies AuthSessionDto;

export const mockConnection = {
  username: "frontend-builder",
  profileUrl: "https://github.com/frontend-builder",
  avatarUrl: "https://avatars.githubusercontent.com/u/9919",
  connectedAt: now,
  /* 설명과 라벨은 lib/scopes.ts가 정의한다. 목이 문장을 따로 들고 있으면
     한쪽만 고쳐졌을 때 화면과 목이 다른 말을 하게 된다. 실제로 그랬다. */
  scopes: REQUESTED_SCOPES.map((scope) => ({
    ...scope,
    granted: scope.name !== "read:org",
  })),
  extraScopes: [],
  needsReauthorization: true,
  manageUrl: "https://github.com/settings/connections/applications/mock-client-id",
} satisfies GitHubConnectionDto;

export const mockCredits = {
  balance: 100,
  initialBalance: 100,
  costPerRepository: 30,
  chargingEnabled: false,
  isMock: true,
} satisfies CreditSummaryDto;

export const mockRepositories = [
  {
    id: "repo_folio",
    githubRepositoryId: "883721",
    owner: {
      username: "frontend-builder",
      avatarUrl: "https://avatars.githubusercontent.com/u/9919",
    },
    name: "folio-maker",
    fullName: "frontend-builder/folio-maker",
    description: "Git 기록을 분석해 취업 포트폴리오를 생성하는 서비스",
    htmlUrl: "https://github.com/frontend-builder/folio-maker",
    defaultBranch: "main",
    primaryLanguage: "TypeScript",
    visibility: "public",
    starCount: 24,
    forkCount: 4,
    pushedAt: "2026-08-15T11:24:00.000Z",
    syncedAt: now,
  },
  {
    id: "repo_signal",
    githubRepositoryId: "883722",
    owner: {
      username: "frontend-builder",
      avatarUrl: "https://avatars.githubusercontent.com/u/9919",
    },
    name: "signal-board",
    fullName: "frontend-builder/signal-board",
    description: "실시간 협업을 위한 팀 인사이트 대시보드",
    htmlUrl: "https://github.com/frontend-builder/signal-board",
    defaultBranch: "develop",
    primaryLanguage: "React",
    visibility: "private",
    starCount: 8,
    forkCount: 2,
    pushedAt: "2026-08-12T09:10:00.000Z",
    syncedAt: now,
  },
  {
    id: "repo_api",
    githubRepositoryId: "883723",
    owner: {
      username: "frontend-builder",
      avatarUrl: "https://avatars.githubusercontent.com/u/9919",
    },
    name: "campus-api",
    fullName: "frontend-builder/campus-api",
    description: "교내 프로젝트와 동아리를 연결하는 REST API",
    htmlUrl: "https://github.com/frontend-builder/campus-api",
    defaultBranch: "main",
    primaryLanguage: "Java",
    visibility: "public",
    starCount: 17,
    forkCount: 5,
    pushedAt: "2026-08-03T02:40:00.000Z",
    syncedAt: now,
  },
  {
    id: "repo_mobile",
    githubRepositoryId: "883724",
    owner: {
      username: "frontend-builder",
      avatarUrl: "https://avatars.githubusercontent.com/u/9919",
    },
    name: "daily-loop",
    fullName: "frontend-builder/daily-loop",
    description: "작은 습관을 기록하고 회고하는 모바일 앱",
    htmlUrl: "https://github.com/frontend-builder/daily-loop",
    defaultBranch: "main",
    primaryLanguage: "Kotlin",
    visibility: "private",
    starCount: 11,
    forkCount: 1,
    pushedAt: "2026-07-28T17:31:00.000Z",
    syncedAt: now,
  },
] satisfies GitRepositoryDto[];

export const mockPortfolioContent = {
  profile: {
    displayName: "김코드",
    headline: "복잡한 문제를 명료한 제품으로 바꾸는 프론트엔드 개발자",
    targetRole: "Frontend Engineer",
    avatarUrl: null,
  },
  introduction:
    "사용자의 망설임을 줄이는 인터페이스를 만듭니다. 기능을 구현하는 데서 멈추지 않고, 데이터 흐름과 실패 상태까지 설계해 팀이 오래 운영할 수 있는 제품을 지향합니다.",
  skills: [
    {
      category: "Frontend",
      skills: ["TypeScript", "React", "Next.js", "CSS Architecture"],
    },
    {
      category: "Collaboration",
      skills: ["REST API Contract", "Git", "Design System"],
    },
  ],
  projects: [
    {
      id: "project_folio",
      title: "Folio Maker",
      description:
        "Git 저장소와 프롬프트를 바탕으로 취업 포트폴리오 초안을 만드는 서비스입니다.",
      repositoryUrl: "https://github.com/frontend-builder/folio-maker",
      role: "Frontend Engineer",
      techStack: ["TypeScript", "React", "Next.js"],
      context: { period: "2026.03–06", scale: "개인" },
      keyDecision: {
        headline: "생성 흐름을 한 단계에서 세 단계로 나눔",
        problem: "저장 단계에서 실패하면 GitHub 수집과 모델 호출까지 통째로 다시 돌았다. 재시도할 때마다 같은 비용이 반복됐다.",
        approach: "단계 사이 산출물을 별도 테이블에 두고, 각 단계가 이미 끝난 일을 건너뛰게 했다. 워크플로 이벤트로 넘기지 않은 것은 근거가 수십 KB라 직렬화할 수 없기 때문이다.",
        outcome: "저장에서 실패해 다시 돌아도 모델을 다시 부르지 않는다.",
      },
      highlights: [
        "계약 기반 mock adapter로 백엔드와 병렬 개발",
        "새로고침 후에도 이어지는 생성 상태 흐름 설계",
      ],
      /* 새 결과는 결정 서사로 쓴다. 이 셋은 규격 이전 결과에만 남는다. */
      challenges: [],
      solutions: [],
      impact: [],
    },
    /* 근거가 얇은 저장소. 실제로 가장 흔한 모양이고, 되묻기 화면이 나오는
       조건이기도 하다. 목이 늘 꽉 찬 결과만 돌려주면 그 화면은 로컬에서
       한 번도 실행되지 않는다 — 저장소 목록이 비는 경우가 그랬다. */
    {
      id: "project_signal",
      title: "Signal Board",
      description: "팀이 보는 지표를 한 화면에 모으는 대시보드입니다.",
      repositoryUrl: "https://github.com/frontend-builder/signal-board",
      role: "프로젝트 개발",
      techStack: ["TypeScript", "React"],
      context: { period: "2026.07", scale: "3명" },
      // 비어 있는 결정. 되묻기 카드가 뜨는 조건이다.
      keyDecision: { headline: "", problem: "", approach: "", outcome: "" },
      highlights: [],
      challenges: [],
      solutions: [],
      impact: [],
    },
  ],
  gitAnalysis: {
    summary:
      "화면과 데이터 계층을 분리하고, 작은 단위로 일관되게 개선해 온 저장소입니다.",
    primaryLanguage: "TypeScript",
    languages: [
      { name: "TypeScript", percentage: 78.4 },
      { name: "CSS", percentage: 17.2 },
      { name: "JavaScript", percentage: 4.4 },
    ],
    starCount: 24,
    forkCount: 4,
    notablePatterns: [
      "계약 중심 데이터 흐름",
      "재사용 가능한 컴포넌트",
      "명확한 오류 상태",
    ],
    lastActivityAt: null,
  },
  contact: {
    githubUrl: "https://github.com/frontend-builder",
    email: "hello@example.com",
    location: "Seoul, Korea",
  },
} satisfies PortfolioContentDto;

/**
 * 되묻기 질문. 하나는 답한 상태, 둘은 아직 답하지 않은 상태로 둔다.
 * 두 모양이 한 화면에 같이 나와야 답한 뒤 무엇이 남는지 보인다.
 */
export const mockPortfolioQuestions = [
  {
    id: "question_signal_problem",
    repositoryName: "signal-board",
    field: "decisionProblem",
    topic: "지표 갱신 주기를 5초에서 30초로 늘린 커밋",
    question: "그 전에는 어떤 문제가 있었나요?",
    answer: null,
  },
  {
    id: "question_signal_approach",
    repositoryName: "signal-board",
    field: "decisionApproach",
    topic: "지표 갱신 주기를 5초에서 30초로 늘린 커밋",
    question: "다른 방법도 있었을 텐데 이 방법을 고른 이유는요?",
    answer: null,
  },
  {
    id: "question_signal_outcome",
    repositoryName: "signal-board",
    field: "decisionOutcome",
    topic: "지표 갱신 주기를 5초에서 30초로 늘린 커밋",
    question: "그래서 무엇이 달라졌나요?",
    answer: null,
  },
  {
    id: "question_signal_role",
    repositoryName: "signal-board",
    field: "role",
    topic: null,
    question: "세 명이 함께 만든 프로젝트인데 어느 부분을 맡으셨나요?",
    answer: null,
  },
  {
    id: "question_signal_highlights",
    repositoryName: "signal-board",
    field: "highlights",
    topic: null,
    question: "이 대시보드에서 직접 만든 것 중 더 남기고 싶은 게 있나요?",
    answer: null,
  },
  /* 결정이 채워진 프로젝트에도 낱개 질문은 남는다. 강조점은 자리가 남아
     있으면 더 물을 수 있어서, 예전처럼 질문이 아예 없는 프로젝트가 줄었다. */
  {
    id: "question_folio_highlights",
    repositoryName: "folio-maker",
    field: "highlights",
    topic: null,
    question: "mock adapter 말고 백엔드와 맞춘 방법이 더 있었나요?",
    answer: null,
  },
  {
    id: "question_folio_role",
    repositoryName: "folio-maker",
    field: "role",
    topic: null,
    question: "혼자 만든 프로젝트인데 설계에서 가장 오래 붙잡은 건 무엇인가요?",
    answer: null,
  },
] satisfies PortfolioQuestionDto[];

export const mockPortfolio = {
  id: "portfolio_demo",
  title: "문제를 제품으로 번역하는 개발자",
  targetRole: "Frontend Engineer",
  repositoryName: "folio-maker",
  repositoryCount: 2,
  share: { published: false, slug: null, url: null },
  techStack: ["TypeScript", "React", "Next.js"],
  createdAt: "2026-08-16T04:03:00.000Z",
  generationJobId: "job_demo",
  repository: mockRepositories[0],
  repositories: [mockRepositories[0], mockRepositories[1]],
  style: "default",
  content: mockPortfolioContent,
  questions: mockPortfolioQuestions,
  updatedAt: "2026-08-16T04:03:00.000Z",
} satisfies PortfolioDto;

export const mockPortfolioSummaries = [
  {
    id: "portfolio_demo",
    title: "문제를 제품으로 번역하는 개발자",
    targetRole: "Frontend Engineer",
    repositoryName: "folio-maker",
    repositoryCount: 2,
    share: {
      published: true,
      slug: "octo-cat-frontend-a3f9k2",
      url: "https://folio.example/p/octo-cat-frontend-a3f9k2",
    },
    techStack: ["TypeScript", "React", "Next.js"],
    createdAt: "2026-08-16T04:03:00.000Z",
  },
  {
    id: "portfolio_signal",
    title: "데이터로 팀의 판단을 돕는 개발자",
    targetRole: "Product Engineer",
    repositoryName: "signal-board",
    repositoryCount: 1,
    share: { published: false, slug: null, url: null },
    techStack: ["React", "WebSocket", "Data Viz"],
    createdAt: "2026-08-11T08:20:00.000Z",
  },
] satisfies PortfolioSummaryDto[];

export const mockAnnouncements = [
  {
    id: "notice_launch",
    type: "event",
    title: "MVP 오픈 기념, 첫 포트폴리오 무료 생성",
    summary: "지금 GitHub 저장소를 연결하고 첫 결과를 만들어보세요.",
    publishedAt: "2026-08-16T00:00:00.000Z",
    endsAt: "2026-08-31T14:59:59.000Z",
    isPinned: true,
  },
  {
    id: "notice_mock",
    type: "notice",
    title: "크레딧과 결제는 아직 체험이에요",
    summary: "표시되는 크레딧과 상품은 흐름을 확인하기 위한 체험 데이터예요.",
    publishedAt: "2026-08-14T02:00:00.000Z",
    endsAt: null,
    isPinned: false,
  },
] satisfies AnnouncementSummaryDto[];

export const mockAnnouncementDetails = mockAnnouncements.map(
  (announcement) => ({
    ...announcement,
    content:
      announcement.type === "event"
        ? "완성된 포트폴리오 예시를 살펴보고, 내 GitHub 저장소로 새로운 소개를 만들어보세요. 생성 과정 전체를 부담 없이 체험할 수 있어요."
        : `${MOCK_NOTE} 표시되는 크레딧과 상품은 흐름을 확인하기 위한 체험 데이터라, 실제 승인도 일어나지 않아요.`,
  }),
) satisfies AnnouncementDto[];

export const mockTasteSample = {
  id: "sample_frontend",
  title: "코드가 소개가 되는 순간",
  description:
    "준비된 GitHub 저장소가 어떤 포트폴리오로 바뀌는지 먼저 확인해보세요.",
  repository: {
    id: "sample_repo",
    name: "folio-maker",
    fullName: "sample/folio-maker",
    description: "취업 포트폴리오 생성 서비스",
    primaryLanguage: "TypeScript",
  },
  prompt:
    "프론트엔드 직무에 맞춰 사용자 경험과 협업 방식을 강조해줘.",
  portfolioPreview: mockPortfolioContent,
  isStatic: true,
} satisfies TasteSampleDto;

export const mockBillingProducts = [
  {
    id: "credit_100",
    name: "Starter 100",
    description: "포트폴리오 3개를 충분히 실험해볼 수 있어요.",
    credits: 100,
    priceKrw: 9900,
    isFeatured: false,
    isMock: true,
  },
  {
    id: "credit_300",
    name: "Builder 300",
    description: "여러 직무와 프롬프트를 비교하고 싶다면 추천해요.",
    credits: 300,
    priceKrw: 24900,
    isFeatured: true,
    isMock: true,
  },
  {
    id: "credit_700",
    name: "Pro 700",
    description: "다양한 프로젝트를 꾸준히 정리하고 싶다면 넉넉해요.",
    credits: 700,
    priceKrw: 49900,
    isFeatured: false,
    isMock: true,
  },
] satisfies BillingProductDto[];

export const mockPayments = [
  {
    id: "mock_payment_01",
    productName: "Starter 100",
    priceKrw: 9900,
    credits: 100,
    status: "mockCompleted",
    balanceChanged: false,
    isMock: true,
    createdAt: "2026-08-10T05:30:00.000Z",
  },
] satisfies MockPaymentDto[];

const galleryProfiles = [
  {
    id: "gallery_frontend",
    title: "경험을 흐름으로 보여주는 프론트엔드 포트폴리오",
    targetRole: "Frontend Engineer",
    description: "사용자 문제, 선택한 해결책과 결과를 한 흐름으로 구성했어요.",
    techStack: ["React", "TypeScript", "CSS"],
    accent: "coral",
  },
  {
    id: "gallery_backend",
    title: "근거가 선명한 백엔드 포트폴리오",
    targetRole: "Backend Engineer",
    description: "API 설계와 성능 개선의 판단 근거를 중심으로 구성했어요.",
    techStack: ["Java", "Spring", "PostgreSQL"],
    accent: "blue",
  },
  {
    id: "gallery_product",
    title: "제품 감각을 담은 풀스택 포트폴리오",
    targetRole: "Product Engineer",
    description: "발견한 문제부터 배포 이후의 학습까지 연결했어요.",
    techStack: ["Next.js", "Node.js", "Analytics"],
    accent: "lime",
  },
  {
    id: "gallery_mobile",
    title: "디테일이 살아있는 모바일 포트폴리오",
    targetRole: "Android Engineer",
    description: "사용성 개선과 안정적인 앱 구조를 프로젝트별로 정리했어요.",
    techStack: ["Kotlin", "Compose", "Room"],
    accent: "violet",
  },
  {
    id: "gallery_data",
    title: "실험과 지표 중심 데이터 포트폴리오",
    targetRole: "Data Analyst",
    description: "질문, 분석 방법과 비즈니스 임팩트를 명확하게 보여줘요.",
    techStack: ["Python", "SQL", "Tableau"],
    accent: "amber",
  },
  {
    id: "gallery_design",
    title: "개발 언어로 설명하는 UX 엔지니어 포트폴리오",
    targetRole: "UX Engineer",
    description: "디자인 시스템과 구현의 접점을 설득력 있게 담았어요.",
    techStack: ["Figma", "React", "Storybook"],
    accent: "pink",
  },
] as const;

export const mockGallerySummaries = galleryProfiles.map((item, index) => ({
  id: item.id,
  title: item.title,
  targetRole: item.targetRole,
  description: item.description,
  thumbnailUrl: `/gallery/${item.accent}-${index + 1}.webp`,
  techStack: [...item.techStack],
  style: "default" as const,
  createdAt: `2026-08-${String(10 - index).padStart(2, "0")}T04:00:00.000Z`,
})) satisfies GalleryExampleSummaryDto[];

export const mockGalleryExamples = mockGallerySummaries.map((item) => ({
  ...item,
  portfolio: {
    ...mockPortfolioContent,
    profile: {
      ...mockPortfolioContent.profile,
      headline: item.title,
      targetRole: item.targetRole,
    },
    skills: [
      {
        category: "Core",
        skills: item.techStack,
      },
    ],
  },
})) satisfies GalleryExampleDto[];

export const mockDashboard = {
  session: mockSession,
  credits: mockCredits,
  tasteSample: mockTasteSample,
  /* 목에서는 진행 중인 작업이 없는 상태를 기본으로 둔다. 진행 카드를 보려면
     NEXT_PUBLIC_MOCK_ACTIVE_JOB=1로 켠다. */
  activeGeneration: null,
  recentPortfolios: mockPortfolioSummaries,
  announcements: mockAnnouncements,
} satisfies DashboardDto;
