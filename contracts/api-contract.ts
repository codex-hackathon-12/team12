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

export interface CreateGenerationRequest {
  repositoryId: EntityId;
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
  repositoryId: EntityId;
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
  repositoryName: string;
  techStack: string[];
  createdAt: IsoDateTime;
}

export interface ResumePdfDto {
  downloadUrl: UrlString;
  generatedAt: IsoDateTime;
}

export interface PortfolioDto extends PortfolioSummaryDto {
  generationJobId: EntityId;
  repository: GitRepositoryDto;
  style: "default";
  resumePdf: ResumePdfDto | null;
  content: PortfolioContentDto;
  updatedAt: IsoDateTime;
}

export interface PortfolioListDto {
  portfolios: PortfolioSummaryDto[];
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
