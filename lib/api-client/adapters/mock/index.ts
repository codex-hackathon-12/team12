import type {
  CreateGenerationRequest,
  CreateMockCheckoutRequest,
  GalleryListQuery,
  GenerationJobDto,
  RepositoryListQuery,
} from "@/contracts/api-contract";
import type { ApiClient } from "@/lib/api-client/client";
import {
  mockAnnouncementDetails,
  mockAnnouncements,
  mockBillingProducts,
  mockCredits,
  mockDashboard,
  mockGalleryExamples,
  mockGallerySummaries,
  mockPayments,
  mockPortfolio,
  mockPortfolioSummaries,
  mockRepositories,
  mockSession,
  mockTasteSample,
} from "@/mocks/api/fixtures";
import { successfulGenerationScenario } from "@/mocks/api/scenarios/generation";

const wait = (duration = 280) =>
  new Promise<void>((resolve) => setTimeout(resolve, duration));

const createCreditQuote = (repositoryCount = 1) => ({
  currentBalance: 100,
  repositoryCount,
  estimatedCost: repositoryCount * 30,
  balanceAfterGeneration: 100,
  willCharge: false as const,
  isMock: true as const,
});

export class MockApiClient implements ApiClient {
  private generationPollCount = new Map<string, number>();
  private generationRepositories = new Map<string, string[]>();
  private deletedPortfolioIds = new Set<string>();
  private publishedPortfolioIds = new Set<string>();

  getGitHubLoginUrl(returnTo: string) {
    return returnTo;
  }

  async getSession() {
    await wait();
    return mockSession;
  }

  async logout() {
    await wait(120);
  }

  async getDashboard() {
    await wait();
    return mockDashboard;
  }

  async getRepositories(query: RepositoryListQuery = {}) {
    await wait();
    const keyword = query.q?.trim().toLowerCase();
    const repositories = mockRepositories.filter((repository) => {
      const matchesKeyword =
        !keyword ||
        repository.name.toLowerCase().includes(keyword) ||
        repository.description?.toLowerCase().includes(keyword);
      const matchesVisibility =
        !query.visibility ||
        query.visibility === "all" ||
        repository.visibility === query.visibility;
      return matchesKeyword && matchesVisibility;
    });
    return { repositories };
  }

  async syncRepositories() {
    await wait(520);
    return {
      repositories: mockRepositories,
      syncedAt: new Date().toISOString(),
    };
  }

  async getRepository(repositoryId: string) {
    await wait(180);
    return (
      mockRepositories.find((repository) => repository.id === repositoryId) ??
      mockRepositories[0]
    );
  }

  async createGeneration(request: CreateGenerationRequest) {
    await wait(420);
    const jobId = `job_${request.repositoryIds.join("_")}`;
    this.generationPollCount.set(jobId, 0);
    this.generationRepositories.set(jobId, request.repositoryIds);
    return this.buildGenerationJob(jobId, 0);
  }

  async getGeneration(jobId: string) {
    await wait(180);
    const current = this.generationPollCount.get(jobId) ?? 0;
    const next = Math.min(current + 1, successfulGenerationScenario.length - 1);
    this.generationPollCount.set(jobId, next);
    return this.buildGenerationJob(jobId, next);
  }

  async retryGeneration(jobId: string) {
    await wait(240);
    const nextJobId = `${jobId}_retry`;
    this.generationPollCount.set(nextJobId, 0);
    this.generationRepositories.set(
      nextJobId,
      this.generationRepositories.get(jobId) ?? [mockRepositories[0].id],
    );
    return {
      previousJobId: jobId,
      job: this.buildGenerationJob(nextJobId, 0),
    };
  }

  async getPortfolios() {
    await wait();
    return {
      portfolios: mockPortfolioSummaries.filter(
        (portfolio) => !this.deletedPortfolioIds.has(portfolio.id),
      ),
      nextCursor: null,
      hasNextPage: false,
    };
  }

  async getPortfolio(portfolioId: string) {
    await wait();
    return {
      ...mockPortfolio,
      id: portfolioId,
    };
  }

  async updatePortfolioShare(portfolioId: string, published: boolean) {
    await wait(220);
    if (published) {
      this.publishedPortfolioIds.add(portfolioId);
    } else {
      this.publishedPortfolioIds.delete(portfolioId);
    }
    const slug = `demo-portfolio-${portfolioId}`;
    return {
      published,
      slug,
      url: published ? `https://folio.example/p/${slug}` : null,
    };
  }

  async getPublicPortfolio(slug: string) {
    await wait();
    return {
      slug,
      title: mockPortfolio.title,
      targetRole: mockPortfolio.targetRole,
      content: mockPortfolio.content,
      repositories: mockPortfolio.repositories.map((repository) => ({
        name: repository.name,
        fullName: repository.fullName,
        htmlUrl: repository.htmlUrl,
      })),
      createdAt: mockPortfolio.createdAt,
    };
  }

  async deletePortfolio(portfolioId: string) {
    await wait(260);
    this.deletedPortfolioIds.add(portfolioId);
    return { deletedId: portfolioId };
  }

  async getCredits() {
    await wait(160);
    return mockCredits;
  }

  async getBillingProducts() {
    await wait();
    return {
      products: mockBillingProducts,
      paymentEnabled: false as const,
      isMock: true as const,
    };
  }

  async createCheckout(request: CreateMockCheckoutRequest) {
    await wait(440);
    const product =
      mockBillingProducts.find((item) => item.id === request.productId) ??
      mockBillingProducts[0];
    return {
      checkoutId: `mock_checkout_${product.id}`,
      product,
      status: "completed" as const,
      redirectPath: "/billing/success" as const,
      creditBalanceBefore: 100,
      creditBalanceAfter: 100,
      balanceChanged: false as const,
      isMock: true as const,
      createdAt: new Date().toISOString(),
    };
  }

  async getPayments() {
    await wait(180);
    return { payments: mockPayments };
  }

  async getGallery(query: GalleryListQuery = {}) {
    await wait();
    const examples = mockGallerySummaries.filter((example) => {
      const matchesRole = !query.role || example.targetRole === query.role;
      const matchesTech =
        !query.techStack ||
        example.techStack.some((tech) => tech === query.techStack);
      return matchesRole && matchesTech;
    });
    return { examples };
  }

  async getGalleryExample(exampleId: string) {
    await wait();
    return (
      mockGalleryExamples.find((example) => example.id === exampleId) ??
      mockGalleryExamples[0]
    );
  }

  async getAnnouncements() {
    await wait(180);
    return { announcements: mockAnnouncements };
  }

  async getAnnouncement(announcementId: string) {
    await wait(180);
    return (
      mockAnnouncementDetails.find(
        (announcement) => announcement.id === announcementId,
      ) ?? mockAnnouncementDetails[0]
    );
  }

  async getTasteSample() {
    await wait(180);
    return mockTasteSample;
  }

  private buildGenerationJob(jobId: string, index: number): GenerationJobDto {
    const step = successfulGenerationScenario[index];
    const timestamp = new Date().toISOString();
    const repositoryIds =
      this.generationRepositories.get(jobId) ?? [mockRepositories[0].id];
    return {
      jobId,
      repositoryId: repositoryIds[0],
      repositoryIds,
      ...step,
      portfolioId: step.status === "completed" ? "portfolio_demo" : null,
      creditQuote: createCreditQuote(repositoryIds.length),
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}
