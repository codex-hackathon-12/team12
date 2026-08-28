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
  type CursorPaginationQuery,
  type DashboardDto,
  type DeletePortfolioDto,
  type GalleryExampleDto,
  type GalleryListDto,
  type GalleryListQuery,
  type GenerationJobDto,
  type GitRepositoryDto,
  type MockCheckoutDto,
  type MockPaymentListDto,
  type PortfolioDto,
  type PortfolioListDto,
  type PortfolioShareDto,
  type PublicPortfolioDto,
  type RepositoryListDto,
  type RepositoryListQuery,
  type RepositorySyncDto,
  type RetryGenerationDto,
  type TasteSampleDto,
} from "@/contracts/api-contract";
import type { ApiClient } from "@/lib/api-client/client";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: ApiErrorResponse,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  get code() {
    return this.response?.error.code;
  }
}

type ApiResponse<TData> =
  | ApiSuccessResponse<TData, CursorPaginationMeta>
  | ApiErrorResponse;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  return (
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
};

const isApiSuccessResponse = <TData>(
  value: unknown,
): value is ApiSuccessResponse<TData, CursorPaginationMeta> =>
  isRecord(value) && "data" in value;

const parseBody = async <TData>(
  response: Response,
): Promise<ApiResponse<TData> | null> => {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  try {
    return (await response.json()) as ApiResponse<TData>;
  } catch {
    return null;
  }
};

const redirectToGitHubLogin = () => {
  if (typeof window === "undefined") return;

  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(
    withQuery(API_ROUTES.auth.githubStart, { returnTo }),
  );
};

const request = async <TData>(url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiClientError(
      "서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
      0,
    );
  }

  const body = await parseBody<TData>(response);
  const requestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok || isApiErrorResponse(body)) {
    const error = isApiErrorResponse(body) ? body : undefined;
    if (response.status === 401) redirectToGitHubLogin();
    throw new ApiClientError(
      error?.error.message ?? "요청을 처리하지 못했습니다.",
      response.status,
      error,
      requestId,
    );
  }

  if (!isApiSuccessResponse<TData>(body)) {
    throw new ApiClientError(
      "서버 응답 형식을 확인하지 못했습니다.",
      response.status,
      undefined,
      requestId,
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

  async getPortfolios(query: CursorPaginationQuery = {}) {
    const response = await request<PortfolioListDto>(
      withQuery(API_ROUTES.portfolios, { ...query }),
    );
    return {
      ...response.data,
      nextCursor: response.meta?.nextCursor ?? null,
      hasNextPage: response.meta?.hasNextPage ?? false,
    };
  }

  async getPortfolio(portfolioId: string) {
    return (
      await request<PortfolioDto>(API_ROUTES.portfolio(portfolioId))
    ).data;
  }

  async deletePortfolio(portfolioId: string) {
    return (
      await request<DeletePortfolioDto>(API_ROUTES.portfolio(portfolioId), {
        method: "DELETE",
      })
    ).data;
  }

  async updatePortfolioShare(portfolioId: string, published: boolean) {
    return (
      await request<PortfolioShareDto>(API_ROUTES.portfolioShare(portfolioId), {
        method: "PUT",
        body: JSON.stringify({ published }),
      })
    ).data;
  }

  async getPublicPortfolio(slug: string) {
    return (await request<PublicPortfolioDto>(API_ROUTES.publicPortfolio(slug))).data;
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
