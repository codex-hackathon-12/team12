import {
  API_ROUTES,
  type AnnouncementDto,
  type AnnouncementListDto,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type AuthSessionDto,
  type BillingProductListDto,
  type CreateGenerationRequest,
  type CreateMockCheckoutRequest,
  type CreditSummaryDto,
  type CursorPaginationMeta,
  type DashboardDto,
  type GalleryExampleDto,
  type GalleryListDto,
  type GalleryListQuery,
  type GenerationJobDto,
  type GitRepositoryDto,
  type MockCheckoutDto,
  type MockPaymentListDto,
  type PortfolioDto,
  type PortfolioListDto,
  type RepositoryListDto,
  type RepositoryListQuery,
  type RepositorySyncDto,
  type RetryGenerationDto,
  type TasteSampleDto,
} from "@/contracts/api-contract";
import type { ApiClient } from "@/lib/api-client/client";

class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: ApiErrorResponse,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const request = async <TData>(url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    credentials: "include",
  });
  const body = (await response.json()) as
    | ApiSuccessResponse<TData, CursorPaginationMeta>
    | ApiErrorResponse;

  if (!response.ok || "error" in body) {
    const error = "error" in body ? body : undefined;
    throw new ApiClientError(
      error?.error.message ?? "요청을 처리하지 못했습니다.",
      response.status,
      error,
    );
  }
  return body;
};

const withQuery = (
  path: string,
  query: Record<string, string | number | undefined>,
) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export class HttpApiClient implements ApiClient {
  getGitHubLoginUrl(returnTo: string) {
    return withQuery(API_ROUTES.auth.githubStart, { returnTo });
  }

  async getSession() {
    return (await request<AuthSessionDto>(API_ROUTES.auth.session)).data;
  }

  async logout() {
    await request(API_ROUTES.auth.logout, { method: "POST" });
  }

  async getDashboard() {
    return (await request<DashboardDto>(API_ROUTES.dashboard)).data;
  }

  async getRepositories(query: RepositoryListQuery = {}) {
    return (
      await request<RepositoryListDto>(
        withQuery(API_ROUTES.repositories, { ...query }),
      )
    ).data;
  }

  async syncRepositories() {
    return (
      await request<RepositorySyncDto>(API_ROUTES.repositorySync, {
        method: "POST",
      })
    ).data;
  }

  async getRepository(repositoryId: string) {
    return (
      await request<GitRepositoryDto>(API_ROUTES.repository(repositoryId))
    ).data;
  }

  async createGeneration(payload: CreateGenerationRequest) {
    return (
      await request<GenerationJobDto>(API_ROUTES.generations, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    ).data;
  }

  async getGeneration(jobId: string) {
    return (await request<GenerationJobDto>(API_ROUTES.generation(jobId))).data;
  }

  async retryGeneration(jobId: string) {
    return (
      await request<RetryGenerationDto>(API_ROUTES.generationRetry(jobId), {
        method: "POST",
      })
    ).data;
  }

  async getPortfolios() {
    return (await request<PortfolioListDto>(API_ROUTES.portfolios)).data;
  }

  async getPortfolio(portfolioId: string) {
    return (
      await request<PortfolioDto>(API_ROUTES.portfolio(portfolioId))
    ).data;
  }

  async getCredits() {
    return (await request<CreditSummaryDto>(API_ROUTES.credits)).data;
  }

  async getBillingProducts() {
    return (
      await request<BillingProductListDto>(API_ROUTES.billingProducts)
    ).data;
  }

  async createCheckout(payload: CreateMockCheckoutRequest) {
    return (
      await request<MockCheckoutDto>(API_ROUTES.billingCheckout, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    ).data;
  }

  async getPayments() {
    return (
      await request<MockPaymentListDto>(API_ROUTES.billingPayments)
    ).data;
  }

  async getGallery(query: GalleryListQuery = {}) {
    return (
      await request<GalleryListDto>(
        withQuery(API_ROUTES.gallery, { ...query }),
      )
    ).data;
  }

  async getGalleryExample(exampleId: string) {
    return (
      await request<GalleryExampleDto>(API_ROUTES.galleryExample(exampleId))
    ).data;
  }

  async getAnnouncements() {
    return (
      await request<AnnouncementListDto>(API_ROUTES.announcements)
    ).data;
  }

  async getAnnouncement(announcementId: string) {
    return (
      await request<AnnouncementDto>(
        API_ROUTES.announcement(announcementId),
      )
    ).data;
  }

  async getTasteSample() {
    return (await request<TasteSampleDto>(API_ROUTES.tasteSample)).data;
  }
}
