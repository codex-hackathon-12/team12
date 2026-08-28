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
  portfolioResumePdf: (portfolioId: string) =>
    `${API_PREFIX}/portfolios/${portfolioId}/resume.pdf`,
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
  | "renderingResume"
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
  message: string;
  portfolioId: EntityId | null;
  resumePdfAvailable: boolean;
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

export interface PortfolioProjectDto {
  id: EntityId;
  title: string;
  description: string;
  repositoryUrl: UrlString;
  role: string;
  techStack: string[];
  highlights: string[];
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
  starCount: number;
  forkCount: number;
  notablePatterns: string[];
}

/**
 * 결과 화면은 단일 컬럼으로 훑어 읽는 문서라 분량 상한이 있다.
 * 상한은 `architecture.md` §6.6을 기준으로 하며 서버가 보장한다.
 *
 * - `profile.headline` 60자, `introduction` 150자
 * - `PortfolioProjectDto.description` 120자
 * - `highlights` 3개(항목 60자), `challenges`·`solutions`·`impact` 각 2개(항목 80자)
 * - `techStack` 8개, `skills` 4개 그룹(그룹당 6개), `notablePatterns` 4개
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

export interface PortfolioSummaryDto {
  id: EntityId;
  title: string;
  targetRole: string;
  /** 대표(첫 번째) 저장소 이름. */
  repositoryName: string;
  /** 이 포트폴리오가 사용한 저장소 수. 1이면 단일 저장소다. */
  repositoryCount: number;
  techStack: string[];
  createdAt: IsoDateTime;
}

export interface ResumePdfDto {
  downloadUrl: UrlString;
  generatedAt: IsoDateTime;
}

export interface PortfolioDto extends PortfolioSummaryDto {
  generationJobId: EntityId;
  /** 대표(첫 번째) 저장소. */
  repository: GitRepositoryDto;
  /** 사용한 저장소 전체를 선택 순서대로 담는다. 항상 1개 이상이다. */
  repositories: GitRepositoryDto[];
  style: "default";
  resumePdf: ResumePdfDto | null;
  content: PortfolioContentDto;
  updatedAt: IsoDateTime;
}

export interface PortfolioListDto {
  portfolios: PortfolioSummaryDto[];
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
