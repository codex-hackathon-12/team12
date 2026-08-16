import type {
  AnnouncementDto,
  AnnouncementListDto,
  AuthSessionDto,
  BillingProductListDto,
  CreateGenerationRequest,
  CreateMockCheckoutRequest,
  CreditSummaryDto,
  DashboardDto,
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
  getPortfolios(): Promise<PortfolioListDto>;
  getPortfolio(portfolioId: string): Promise<PortfolioDto>;
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
