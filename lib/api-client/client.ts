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
  GitHubConnectionDto,
  GitRepositoryDto,
  MockCheckoutDto,
  MockPaymentListDto,
  PortfolioDto,
  PortfolioListDto,
  PortfolioShareDto,
  PublicPortfolioDto,
  RepositoryListDto,
  RepositoryListQuery,
  RepositorySyncDto,
  RetryGenerationDto,
  TasteSampleDto,
} from "@/contracts/api-contract";

export interface ApiClient {
  getGitHubLoginUrl(returnTo: string): string;
  getSession(): Promise<AuthSessionDto>;
  /** 연동된 GitHub 계정과 실제로 부여된 스코프. 설정 화면에서 쓴다. */
  getConnection(): Promise<GitHubConnectionDto>;
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
  /** 공개 여부를 전환한다. 슬러그는 유지되므로 다시 공개하면 같은 링크가 살아난다. */
  updatePortfolioShare(portfolioId: string, published: boolean): Promise<PortfolioShareDto>;
  /** 인증 없이 조회하는 공개 포트폴리오. */
  getPublicPortfolio(slug: string): Promise<PublicPortfolioDto>;
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
