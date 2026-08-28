import type {
  AnnouncementDto,
  AnnouncementListDto,
  AuthSessionDto,
  BillingProductListDto,
  CreateGenerationRequest,
  CreateMockCheckoutRequest,
  CreditSummaryDto,
  CursorPaginationMeta,
  CursorPaginationQuery,
  DashboardDto,
  DeletePortfolioDto,
  GalleryExampleDto,
  GalleryListDto,
  GalleryListQuery,
  GenerationJobDto,
  GitRepositoryDto,
  MockCheckoutDto,
  MockPaymentListDto,
  PortfolioDto,
  PortfolioListDto,
  RepositoryListDto,
  RepositoryListQuery,
  RepositorySyncDto,
  RetryGenerationDto,
  TasteSampleDto,
} from "@/contracts/api-contract";

export interface ApiClient {
  getGitHubLoginUrl(returnTo: string): string;
  getSession(): Promise<AuthSessionDto>;
  logout(): Promise<void>;
  getDashboard(): Promise<DashboardDto>;
  getRepositories(query?: RepositoryListQuery): Promise<RepositoryListDto>;
  syncRepositories(): Promise<RepositorySyncDto>;
  getRepository(repositoryId: string): Promise<GitRepositoryDto>;
  createGeneration(request: CreateGenerationRequest): Promise<GenerationJobDto>;
  getGeneration(jobId: string): Promise<GenerationJobDto>;
  retryGeneration(jobId: string): Promise<RetryGenerationDto>;
  /** 목록은 커서 페이지네이션을 쓴다. meta를 함께 돌려주지 않으면 기본 20건에서 조용히 잘린다. */
  getPortfolios(
    query?: CursorPaginationQuery,
  ): Promise<PortfolioListDto & CursorPaginationMeta>;
  getPortfolio(portfolioId: string): Promise<PortfolioDto>;
  /** 되돌릴 수 없는 영구 삭제다. 호출 전에 사용자 확인을 받아야 한다. */
  deletePortfolio(portfolioId: string): Promise<DeletePortfolioDto>;
  getCredits(): Promise<CreditSummaryDto>;
  getBillingProducts(): Promise<BillingProductListDto>;
  createCheckout(request: CreateMockCheckoutRequest): Promise<MockCheckoutDto>;
  getPayments(): Promise<MockPaymentListDto>;
  getGallery(query?: GalleryListQuery): Promise<GalleryListDto>;
  getGalleryExample(exampleId: string): Promise<GalleryExampleDto>;
  getAnnouncements(): Promise<AnnouncementListDto>;
  getAnnouncement(announcementId: string): Promise<AnnouncementDto>;
  getTasteSample(): Promise<TasteSampleDto>;
}
