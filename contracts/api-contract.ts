/**
 * 프론트엔드와 백엔드가 공유하는 REST API 계약이다.
 * DB 모델, React 타입, 외부 SDK 타입을 이 파일에 포함하지 않는다.
 */

export const API_PREFIX = "/api/v1" as const;

export const MOCK_CREDIT_POLICY = {
  initialBalance: 100,
  costPerRepository: 30,
  chargingEnabled: false,
  paymentEnabled: false,
} as const;

export const API_ROUTES = {
  auth: {
    githubStart: `${API_PREFIX}/auth/github`,
    githubCallback: `${API_PREFIX}/auth/github/callback`,
    session: `${API_PREFIX}/auth/session`,
    connection: `${API_PREFIX}/auth/connection`,
    logout: `${API_PREFIX}/auth/logout`,
  },
  dashboard: `${API_PREFIX}/dashboard`,
  repositories: `${API_PREFIX}/repositories`,
  repositorySync: `${API_PREFIX}/repositories/sync`,
  repository: (repositoryId: string) =>
    `${API_PREFIX}/repositories/${repositoryId}`,
  generations: `${API_PREFIX}/generations`,
  generation: (jobId: string) => `${API_PREFIX}/generations/${jobId}`,
  generationRetry: (jobId: string) =>
    `${API_PREFIX}/generations/${jobId}/retry`,
  portfolios: `${API_PREFIX}/portfolios`,
  portfolio: (portfolioId: string) =>
    `${API_PREFIX}/portfolios/${portfolioId}`,
  portfolioShare: (portfolioId: string) =>
    `${API_PREFIX}/portfolios/${portfolioId}/share`,
  portfolioStatements: (portfolioId: string) =>
    `${API_PREFIX}/portfolios/${portfolioId}/statements`,
  portfolioQuestions: (portfolioId: string) =>
    `${API_PREFIX}/portfolios/${portfolioId}/questions`,
  portfolioDecisionCandidates: (portfolioId: string, repositoryName: string) =>
    `${API_PREFIX}/portfolios/${portfolioId}/decision-candidates`
    + `?repositoryName=${encodeURIComponent(repositoryName)}`,
  publicPortfolio: (slug: string) =>
    `${API_PREFIX}/public/portfolios/${slug}`,
  credits: `${API_PREFIX}/credits`,
  billingProducts: `${API_PREFIX}/billing/products`,
  billingCheckout: `${API_PREFIX}/billing/checkout`,
  billingPayments: `${API_PREFIX}/billing/payments`,
  gallery: `${API_PREFIX}/gallery`,
  galleryExample: (exampleId: string) =>
    `${API_PREFIX}/gallery/${exampleId}`,
  announcements: `${API_PREFIX}/announcements`,
  announcement: (announcementId: string) =>
    `${API_PREFIX}/announcements/${announcementId}`,
  tasteSample: `${API_PREFIX}/taste/sample`,
  account: `${API_PREFIX}/account`,
} as const;

export type EntityId = string;
export type IsoDateTime = string;
export type UrlString = string;

export interface ApiSuccessResponse<TData, TMeta = Record<string, never>> {
  data: TData;
  meta?: TMeta;
}

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FAILED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "GITHUB_CONNECTION_ERROR"
  | "GITHUB_RATE_LIMITED"
  | "GENERATION_IN_PROGRESS"
  | "GENERATION_FAILED"
  | "JOB_NOT_RETRYABLE"
  /** 생성 근거가 남아 있지 않아 되묻기 답변을 반영할 수 없다. 재시도해도 같다. */
  | "EVIDENCE_UNAVAILABLE"
  /** 이미 채워진 자리를 열려 했다. 물어도 답이 반영될 곳이 없다. */
  | "SLOT_ALREADY_FILLED"
  | "ACCOUNT_DELETION_IN_PROGRESS"
  | "MOCK_PAYMENT_FAILED"
  | "TOO_MANY_REPOSITORIES"
  | "INTERNAL_ERROR";

export interface ApiFieldError {
  field: string;
  reason: string;
}

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: {
      fields?: ApiFieldError[];
      retryable?: boolean;
      requestId?: string;
    };
  };
}

export interface CursorPaginationQuery {
  cursor?: string;
  limit?: number;
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}

// Authentication

export interface GitHubUserDto {
  id: EntityId;
  githubUserId: string;
  username: string;
  displayName: string;
  avatarUrl: UrlString;
  profileUrl: UrlString;
  email: string | null;
  creditBalance: number;
  createdAt: IsoDateTime;
}

export interface AuthSessionDto {
  authenticated: boolean;
  provider: "github" | null;
  user: GitHubUserDto | null;
}

export interface GitHubScopeDto {
  /** GitHub OAuth 스코프 문자열. 예: "repo" */
  name: string;
  label: string;
  description: string;
  /** 이 스코프 없이는 동작하지 않는 기능이 있는지. */
  required: boolean;
  granted: boolean;
}

export interface GitHubConnectionDto {
  username: string;
  profileUrl: string;
  avatarUrl: string;
  connectedAt: string;
  scopes: GitHubScopeDto[];
  /** 요청한 적 없는데 부여돼 있는 스코프. 과거 연동에서 남는다. */
  extraScopes: string[];
  /** 재연동이 필요한 상태인지. 요청 스코프 중 빠진 것이 있으면 true. */
  needsReauthorization: boolean;
  /** 조직 접근 승인과 권한 취소를 할 수 있는 GitHub 설정 페이지. */
  manageUrl: string;
}

export interface LogoutResultDto {
  loggedOut: true;
}

// Repositories

export type RepositoryVisibility = "public" | "private";

export interface RepositoryOwnerDto {
  username: string;
  avatarUrl: UrlString;
}

export interface GitRepositoryDto {
  id: EntityId;
  githubRepositoryId: string;
  owner: RepositoryOwnerDto;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: UrlString;
  defaultBranch: string;
  primaryLanguage: string | null;
  visibility: RepositoryVisibility;
  starCount: number;
  forkCount: number;
  pushedAt: IsoDateTime;
  syncedAt: IsoDateTime;
}

export interface RepositoryListQuery extends CursorPaginationQuery {
  q?: string;
  visibility?: RepositoryVisibility | "all";
}

export interface RepositoryListDto {
  repositories: GitRepositoryDto[];
}

export interface RepositorySyncDto {
  repositories: GitRepositoryDto[];
  syncedAt: IsoDateTime;
}

// Credits

export interface CreditQuoteDto {
  currentBalance: number;
  repositoryCount: number;
  estimatedCost: number;
  balanceAfterGeneration: number;
  willCharge: false;
  isMock: true;
}

export interface CreditSummaryDto {
  balance: number;
  initialBalance: 100;
  costPerRepository: 30;
  chargingEnabled: false;
  isMock: true;
}

// Portfolio generation

export type PortfolioTone = "professional" | "concise" | "storytelling";

/** 한 번의 생성에 넣을 수 있는 저장소 수의 상한. */
export const MAX_GENERATION_REPOSITORIES = 5;

/**
 * 생성 요청 입력의 상한.
 *
 * 서버가 이미 이 값들로 검증하고 있었는데 화면은 몰랐다. 그래서 강조점은
 * 11개째부터 400으로 거절당했고, 지원 직무는 100자에서 조용히 잘렸다. 둘 다
 * 사용자에게는 이유가 보이지 않는 실패다.
 *
 * 화면이 상한을 알아야 미리 알려줄 수 있다. 숫자를 화면에 따로 적으면 서버와
 * 갈라지므로 여기 한 곳에서만 정한다.
 */
export const GENERATION_INPUT_LIMITS = {
  prompt: 2000,
  targetRole: 100,
  highlights: 10,
  highlightLength: 100,
} as const;

export interface CreateGenerationRequest {
  /** 1개 이상 `MAX_GENERATION_REPOSITORIES`개 이하. 순서가 프로젝트 순서가 된다. */
  repositoryIds: EntityId[];
  prompt: string;
  targetRole?: string;
  tone?: PortfolioTone;
  highlights?: string[];
}

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type GenerationStage =
  | "queued"
  | "analyzingRepository"
  | "generatingContent"
  | "renderingPortfolio"
  | "completed"
  | "failed";

export interface GenerationJobDto {
  jobId: EntityId;
  /** 대표(첫 번째) 저장소. 단일 저장소 화면과의 호환을 위해 유지한다. */
  repositoryId: EntityId;
  /** 선택한 저장소 전체를 선택 순서대로 담는다. */
  repositoryIds: EntityId[];
  status: GenerationStatus;
  stage: GenerationStage;
  progress: number;
  /** 진단용 기록. 화면에 그대로 쓰지 않는다 — 문구는 lib/copy.ts가 만든다. */
  message: string;
  portfolioId: EntityId | null;
  creditQuote: CreditQuoteDto;
  error:
    | {
        code: ApiErrorCode;
        message: string;
        retryable: boolean;
      }
    | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RetryGenerationDto {
  previousJobId: EntityId;
  job: GenerationJobDto;
}

export interface AccountDeletionDto {
  deletionJobId: EntityId;
  status: "queued";
}

// Generated portfolio

export interface PortfolioProfileDto {
  displayName: string;
  headline: string;
  targetRole: string;
  avatarUrl: UrlString | null;
}

export interface PortfolioContactDto {
  githubUrl: UrlString;
  email: string | null;
  location: string | null;
}

export interface PortfolioSkillGroupDto {
  category: string;
  skills: string[];
}

/**
 * 프로젝트에서 가장 판단이 필요했던 결정 하나.
 *
 * 면접관이 읽는 것은 나열이 아니라 결정이다. "무엇을 했다"는 줄이 열 개
 * 있는 것보다, 왜 그렇게 골랐는지가 보이는 결정 하나가 대화를 시작한다.
 * 짧은 불릿만으로는 그 인과가 끊겨 자소서처럼 읽힌다.
 *
 * 네 필드는 근거가 없으면 빈 문자열이다. null 대신 빈 문자열을 쓰는 것은
 * "근거가 없으면 빈 배열"이라는 이 계약의 기존 규칙과 같은 모양이고,
 * 생성 schema의 strict 모드에서 다루기도 쉽기 때문이다.
 * `headline`이 비면 결정 자체가 없는 것으로 본다.
 */
export interface PortfolioKeyDecisionDto {
  /** 무엇을 정했나. 한 줄. */
  headline: string;
  /** 왜 정해야 했나 — 그 전에 무엇이 문제였나. */
  problem: string;
  /** 무엇을 골랐고 왜 그것을 골랐나. 근거에 대안이 있으면 함께 적는다. */
  approach: string;
  /** 그래서 무엇이 달라졌나. */
  outcome: string;
}

/**
 * 프로젝트를 읽기 전에 필요한 맥락.
 *
 * 면접관이 가장 먼저 찾는 것이 "언제, 몇 명이서"다. 이 값은 모델이 아니라
 * 서버가 GitHub 근거에서 직접 만든다. 날짜와 인원은 관찰되는 사실이라
 * 모델에게 맡길 이유가 없다.
 */
export interface PortfolioProjectContextDto {
  /** 본인 커밋 기준 기여 기간. 예: "2026.03–06". 계산할 수 없으면 null. */
  period: string | null;
  /** "개인" 또는 "3명". 기여자 수에서 만든다. */
  scale: string | null;
}

export interface PortfolioProjectDto {
  id: EntityId;
  title: string;
  description: string;
  repositoryUrl: UrlString;
  role: string;
  techStack: string[];
  context: PortfolioProjectContextDto;
  keyDecision: PortfolioKeyDecisionDto;
  highlights: string[];
  /**
   * 규격 이전 결과의 서술 항목.
   *
   * 새 결과는 `keyDecision` 하나로 쓴다. 이 셋을 계약에서 지우지 않는 것은
   * 이미 저장된 포트폴리오가 값을 들고 있어서다 — 지우면 그 사람들의 문서에서
   * 문장이 사라진다. 화면은 `keyDecision`이 있으면 그것을, 없으면 이 셋을 쓴다.
   */
  challenges: string[];
  solutions: string[];
  impact: string[];
}

export interface GitLanguageDto {
  name: string;
  percentage: number;
}

export interface PortfolioGitAnalysisDto {
  summary: string;
  primaryLanguage: string | null;
  languages: GitLanguageDto[];
  /** 별과 fork 수는 개인 프로젝트에서 대부분 0이라 화면에 쓰지 않는다. 데이터로만 남긴다. */
  starCount: number;
  forkCount: number;
  notablePatterns: string[];
  /** 선택한 저장소 중 가장 최근에 push된 시각. 규격 이전 결과에는 없어 null이 온다. */
  lastActivityAt: IsoDateTime | null;
}

/**
 * 결과 화면은 단일 컬럼으로 훑어 읽는 문서라 분량 상한이 있다.
 * 상한은 `architecture.md` §6.6을 기준으로 하며 서버가 보장한다.
 *
 * - `profile.headline` 80자, `introduction` 220자
 * - `PortfolioProjectDto.description` 160자
 * - `highlights` 4개(항목 70자), `challenges`·`solutions`·`impact` 각 3개(항목 90자)
 * - `techStack` 10개, `skills` 5개 그룹(그룹당 8개), `notablePatterns` 4개
 *
 * 상한은 채워야 할 목표가 아니다. 근거가 없으면 빈 배열이 온다.
 * 프론트엔드는 배열이 비면 라벨과 컨테이너까지 렌더링하지 않으며,
 * `contact.location`처럼 null이 올 수 있는 값을 예시 문자열로 대체하지 않는다.
 */
export interface PortfolioContentDto {
  profile: PortfolioProfileDto;
  introduction: string;
  skills: PortfolioSkillGroupDto[];
  projects: PortfolioProjectDto[];
  gitAnalysis: PortfolioGitAnalysisDto;
  contact: PortfolioContactDto;
}

/**
 * 지원자에게 되묻는 자리.
 *
 * 저장소에는 코드와 기록만 있고 "왜 그렇게 했는지"와 "그래서 무엇이 달라졌는지"는
 * 없다. 그건 만든 사람만 안다. 이력서에서 가장 값진 것이 정확히 그 둘이라,
 * 초안이 그 자리를 비워두면 비워둔 채로 두지 않고 지원자에게 묻는다.
 *
 * 답은 지어낸 것이 아니라 본인이 쓴 것이므로 면접에서 그대로 설명할 수 있다.
 * 그래서 저장소 근거와 나란한 사실로 취급된다.
 */
export type PortfolioStatementField =
  | "impact"
  | "challenges"
  | "solutions"
  | "role"
  | "highlights"
  /**
   * 핵심 결정을 이루는 세 조각.
   *
   * "성과를 알려주세요"처럼 넓게 물으면 무엇을 답할지 알 수 없다. 한 결정을
   * 문제·선택·결과로 나눠 물으면 각 질문이 한두 문장으로 답할 만해진다.
   * 셋은 같은 `topic`을 공유해 한 카드로 묶인다.
   */
  | "decisionProblem"
  | "decisionApproach"
  | "decisionOutcome";

export interface PortfolioQuestionDto {
  id: EntityId;
  /** 어느 프로젝트에 대한 질문인지. 저장소 전체에 대한 질문이면 null. */
  repositoryName: string | null;
  field: PortfolioStatementField;
  /**
   * 이 질문이 어떤 결정에 대한 것인지 짚는 한 줄. 예: "재시도 처리를
   * withRetry로 감싼 커밋". 같은 topic을 가진 질문들은 한 카드로 묶여
   * 함께 답한다. 낱개 질문은 null이다.
   */
  topic: string | null;
  question: string;
  /** 아직 답하지 않았으면 null. 답한 그대로 돌려준다. */
  answer: string | null;
}

/**
 * 답변 상한. 화면에 그대로 표시해야 조용한 절단이 생기지 않는다.
 *
 * 두세 문장이면 충분한 분량이다. 더 길어지면 모델이 요약하며 지원자가 말한
 * 것을 잃고, 프롬프트도 저장소 근거를 밀어낼 만큼 커진다.
 */
export const PORTFOLIO_ANSWER_MAX_LENGTH = 600;

export interface PortfolioAnswerInput {
  questionId: EntityId;
  answer: string;
}

export interface AnswerPortfolioQuestionsRequest {
  answers: PortfolioAnswerInput[];
}

/**
 * 지원자가 직접 열 수 있는 빈 자리.
 *
 * 되묻기 질문은 포트폴리오를 만들 때 초안과 함께 한 번 생긴다. 그래서 모델이
 * 어떤 저장소에 대해 결정 묶음을 내지 않으면 — 셋 중 하나만 내도 묶음째
 * 버려지므로 — 그 프로젝트의 핵심 결정은 영영 빈 채로 남았다. 생성 지침은
 * "비워두면 나중에 지원자에게 직접 물어볼 수 있다"고 적어놓았는데, 물어볼
 * 통로가 그 모델 호출 안에만 있었다.
 *
 * 자리 단위로 연다. `keyDecision`은 세 조각이 한 결정을 이루므로 하나의
 * 선택지다 — 조각을 따로 열면 반쪽짜리 결정이 다시 생긴다.
 */
export type PortfolioQuestionSlot = "keyDecision" | "highlights";

/**
 * 한 프로젝트가 가질 수 있는 강조점 수.
 *
 * 화면과 서버가 같은 값을 봐야 한다. 화면은 이 수보다 적을 때만 "강조 더
 * 쓰기"를 내밀고 서버는 같은 조건으로 자리를 열어주므로, 두 곳에 따로 적으면
 * 상한을 바꿀 때 한쪽만 남아 버튼이 안 뜨거나 눌러도 거절당한다.
 */
export const PORTFOLIO_HIGHLIGHT_SLOTS = 4;

export interface RequestPortfolioQuestionsRequest {
  /** 어느 프로젝트의 자리인지. 저장소 이름으로 가리킨다. */
  repositoryName: string;
  slot: PortfolioQuestionSlot;
  /**
   * 어떤 결정에 대해 물을지. 저장소에서 본 그대로의 한 줄이다.
   *
   * 비워두면 "가장 판단이 필요했던 선택"을 두루 묻는다. 채워 보내면 그 줄이
   * 질문에 붙어 지원자가 "아, 그거" 하고 떠올릴 수 있게 된다.
   */
  topic?: string;
  /**
   * 이미 채워진 결정을 **다른 결정으로 바꾼다.**
   *
   * 초안은 저장소에서 결정 하나를 스스로 골라 쓴다. 그게 지원자가 말하고 싶은
   * 결정이 아닐 수 있는데 바꿀 방법이 없었다. 이 값이 참이면 채워진 자리도
   * 연다 — 문서의 기존 결정은 새 답이 다 모일 때까지 그대로 남는다.
   */
  replace?: boolean;
}

/**
 * 저장소에서 찾은 결정 후보.
 *
 * 초안이 결정을 고르는 일은 모델이 한다. 그런데 무엇이 말할 만한 결정인지는
 * 만든 사람이 안다. 저장소에 실제로 남아 있는 본인 PR과 커밋 제목을 그대로
 * 보여주고 고르게 한다 — 생성 지침이 말하는 topic이 원래 "커밋 제목, 함수
 * 이름, 파일 경로처럼 지원자가 '아, 그거' 하고 떠올릴 수 있는 것"이라,
 * 다듬지 않은 원문이 이 자리에 맞는 모양이다.
 *
 * 모델을 부르지 않는다. 생성 근거가 남아 있지 않으면 빈 목록이 오고, 그때는
 * 두루 묻는 질문으로 연다.
 */
export interface PortfolioDecisionCandidateDto {
  /** 저장소에서 본 그대로의 한 줄. */
  topic: string;
  source: "commit" | "pullRequest";
  /** 본문이 있어 "왜"가 적혀 있을 만한 것. 앞에 놓는다. */
  hasContext: boolean;
}

/**
 * 답변 반영 결과.
 *
 * 전체 재생성이 아니다. 마음에 들던 문장까지 바뀌면 답할 이유가 없어지므로,
 * 답한 자리만 다시 쓰고 나머지는 글자 하나 건드리지 않는다. 무엇이 실제로
 * 바뀌었는지는 `updatedFields`로 돌려주므로 화면이 그것만 짚어 보여줄 수 있다.
 */
export interface PortfolioRewrittenFieldDto {
  repositoryName: string | null;
  field: PortfolioStatementField;
}

/**
 * 답한 자리인데 문서가 바뀌지 않은 이유.
 *
 * 서버는 왜 버렸는지 알고 있었지만 화면에 넘기지 않았다. 그래서 안내가
 * "조금 더 구체적으로 적어주시면"이라는 추측으로 남았고, 실제 원인이
 * 수치 검증이었을 때 사용자는 자기 답의 어디가 문제인지 알 방법이 없었다.
 */
export type PortfolioSkipReason =
  /** 모델이 빈 값을 돌려줬다. 근거가 없어 못 썼다는 뜻이다. */
  | "empty"
  /** 이미 그렇게 쓰여 있다. */
  | "same"
  /** 결정 네 값 중 하나가 비어 반영하지 않았다. 셋이 다 있어야 한다. */
  | "incomplete"
  /** 근거 어디에도 없는 수치가 들어 있어 문장을 걷어냈다. */
  | "numbers"
  /** 모델 응답에 그 저장소가 없었다. */
  | "unavailable";

export interface PortfolioSkippedFieldDto {
  repositoryName: string | null;
  field: PortfolioStatementField;
  reason: PortfolioSkipReason;
}

export interface PortfolioStatementResultDto {
  content: PortfolioContentDto;
  questions: PortfolioQuestionDto[];
  updatedFields: PortfolioRewrittenFieldDto[];
  /** 답했지만 문서가 바뀌지 않은 자리와 그 이유. */
  skippedFields: PortfolioSkippedFieldDto[];
}

/**
 * 공개 링크 상태. `published`가 false여도 슬러그는 유지된다.
 * 공개를 껐다 켜도 이미 보낸 링크가 그대로 살아 있어야 하기 때문이다.
 */
export interface PortfolioShareDto {
  published: boolean;
  slug: string | null;
  /** 공개 상태일 때만 채워지는 절대 경로. 비공개면 null이다. */
  url: UrlString | null;
}

export interface UpdatePortfolioShareRequest {
  published: boolean;
}

export interface PortfolioSummaryDto {
  id: EntityId;
  title: string;
  targetRole: string;
  /** 대표(첫 번째) 저장소 이름. */
  repositoryName: string;
  /** 이 포트폴리오가 사용한 저장소 수. 1이면 단일 저장소다. */
  repositoryCount: number;
  share: PortfolioShareDto;
  techStack: string[];
  createdAt: IsoDateTime;
}

export interface PortfolioDto extends PortfolioSummaryDto {
  generationJobId: EntityId;
  /** 대표(첫 번째) 저장소. */
  repository: GitRepositoryDto;
  /** 사용한 저장소 전체를 선택 순서대로 담는다. 항상 1개 이상이다. */
  repositories: GitRepositoryDto[];
  style: "default";
  content: PortfolioContentDto;
  /**
   * 초안이 채우지 못한 자리에 대한 질문. 답한 것은 `answer`가 채워져 온다.
   * 규격 이전에 만들어진 포트폴리오에는 질문이 없어 빈 배열이 온다.
   */
  questions: PortfolioQuestionDto[];
  updatedAt: IsoDateTime;
}

export interface PortfolioListDto {
  portfolios: PortfolioSummaryDto[];
}

/**
 * 공개 페이지 전용 DTO. 인증 없이 조회되므로 소유자를 식별할 수 있는 값을
 * 담지 않는다. 포트폴리오 id, 생성 작업 id, 내부 저장소 id는 제외한다.
 */
export interface PublicPortfolioDto {
  slug: string;
  title: string;
  targetRole: string;
  content: PortfolioContentDto;
  /** 저장소 이름과 공개 URL만 담는다. */
  repositories: Array<{ name: string; fullName: string; htmlUrl: UrlString }>;
  createdAt: IsoDateTime;
}

/**
 * 포트폴리오 삭제는 되돌릴 수 없다. DB 행과 Storage의 PDF를 함께 지운다.
 * 생성 작업 기록은 남으며 `portfolioId`만 비워진다.
 */
export interface DeletePortfolioDto {
  deletedId: EntityId;
}

// Dashboard and taste sample

export interface TasteSampleDto {
  id: EntityId;
  title: string;
  description: string;
  repository: Pick<
    GitRepositoryDto,
    "id" | "name" | "fullName" | "description" | "primaryLanguage"
  >;
  prompt: string;
  portfolioPreview: PortfolioContentDto;
  isStatic: true;
}

export type AnnouncementType = "notice" | "event";

export interface AnnouncementSummaryDto {
  id: EntityId;
  type: AnnouncementType;
  title: string;
  summary: string;
  publishedAt: IsoDateTime;
  endsAt: IsoDateTime | null;
  isPinned: boolean;
}

export interface AnnouncementDto extends AnnouncementSummaryDto {
  content: string;
}

export interface DashboardDto {
  session: AuthSessionDto;
  credits: CreditSummaryDto;
  tasteSample: TasteSampleDto;
  /** 진행 중이거나 방금 실패한 생성. 없으면 null. 사용자당 하나만 존재한다. */
  activeGeneration: GenerationJobDto | null;
  recentPortfolios: PortfolioSummaryDto[];
  announcements: AnnouncementSummaryDto[];
}

// Mock billing

export interface BillingProductDto {
  id: EntityId;
  name: string;
  description: string;
  credits: number;
  priceKrw: number;
  isFeatured: boolean;
  isMock: true;
}

export interface BillingProductListDto {
  products: BillingProductDto[];
  paymentEnabled: false;
  isMock: true;
}

export interface CreateMockCheckoutRequest {
  productId: EntityId;
}

export interface MockCheckoutDto {
  checkoutId: EntityId;
  product: BillingProductDto;
  status: "completed";
  redirectPath: "/billing/success";
  creditBalanceBefore: number;
  creditBalanceAfter: number;
  balanceChanged: false;
  isMock: true;
  createdAt: IsoDateTime;
}

export interface MockPaymentDto {
  id: EntityId;
  productName: string;
  priceKrw: number;
  credits: number;
  status: "mockCompleted";
  balanceChanged: false;
  isMock: true;
  createdAt: IsoDateTime;
}

export interface MockPaymentListDto {
  payments: MockPaymentDto[];
}

// Public gallery

export interface GalleryExampleSummaryDto {
  id: EntityId;
  title: string;
  targetRole: string;
  description: string;
  thumbnailUrl: UrlString;
  techStack: string[];
  style: "default";
  createdAt: IsoDateTime;
}

export interface GalleryExampleDto extends GalleryExampleSummaryDto {
  portfolio: PortfolioContentDto;
}

export interface GalleryListQuery extends CursorPaginationQuery {
  role?: string;
  techStack?: string;
}

export interface GalleryListDto {
  examples: GalleryExampleSummaryDto[];
}

export interface AnnouncementListDto {
  announcements: AnnouncementSummaryDto[];
}
