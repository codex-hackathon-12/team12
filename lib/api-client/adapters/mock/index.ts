import type {
  CreateGenerationRequest,
  CreateMockCheckoutRequest,
  GalleryListQuery,
  GenerationJobDto,
  PortfolioAnswerInput,
  PortfolioContentDto,
  PortfolioQuestionDto,
  RepositoryListQuery,
} from "@/contracts/api-contract";
import type { ApiClient } from "@/lib/api-client/client";
import {
  mockAnnouncementDetails,
  mockAnnouncements,
  mockBillingProducts,
  mockConnection,
  mockCredits,
  mockDashboard,
  mockGalleryExamples,
  mockGallerySummaries,
  mockPayments,
  mockPortfolio,
  mockPortfolioContent,
  mockPortfolioQuestions,
  mockPortfolioSummaries,
  mockRepositories,
  mockSession,
  mockTasteSample,
} from "@/mocks/api/fixtures";
import { successfulGenerationScenario } from "@/mocks/api/scenarios/generation";

const wait = (duration = 280) =>
  new Promise<void>((resolve) => setTimeout(resolve, duration));

/**
 * 목은 여태 한 번도 실패하지 않았다. 로컬 개발이 목으로 도는 탓에 화면의 실패
 * 경로는 실제로 실행된 적이 없었고, 그래서 catch가 빠진 화면들이 무한 스피너나
 * 영구 비활성 버튼으로 남아 있었다. 실패를 주입할 수 있어야 그 경로를 본다.
 *
 * NEXT_PUBLIC_MOCK_FAILURE=all 또는 쉼표로 이어 붙인 메서드 이름을 쓴다.
 * 예: NEXT_PUBLIC_MOCK_FAILURE=getPortfolio,syncRepositories
 */
const failingOperations = (process.env.NEXT_PUBLIC_MOCK_FAILURE ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

async function maybeFail(operation: string): Promise<void> {
  if (failingOperations.includes("all") || failingOperations.includes(operation)) {
    await wait(120);
    throw new Error(`Mock failure for ${operation}.`);
  }
}

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
  /* 답변은 목에서도 남아야 한다. 새로고침 없이 다시 열었을 때 답이 사라지면
     "답한 부분만 바뀐다"를 화면에서 확인할 수 없다. */
  private answers = new Map<string, string>();

  getGitHubLoginUrl(returnTo: string) {
    return returnTo;
  }

  async getSession() {
    await maybeFail("getSession");
    await wait();
    return mockSession;
  }

  async getConnection() {
    await maybeFail("getConnection");
    await wait();
    return mockConnection;
  }

  async logout() {
    await maybeFail("logout");
    await wait(120);
  }

  async getDashboard() {
    await maybeFail("getDashboard");
    await wait();
    /* 진행 카드는 실제로 생성을 돌려야 보이므로 로컬에서 확인할 방법이 필요하다.
       실패 변형은 만들 방법이 아예 없어 눈으로 확인한 적이 없었고, 그 사이에
       진행 중과 같은 라임 배경을 쓰고 있었다. `=failed`로 그 상태도 연다. */
    const activeJobMode = process.env.NEXT_PUBLIC_MOCK_ACTIVE_JOB;
    if (activeJobMode) {
      const job = this.buildGenerationJob("job_demo", 1);
      return {
        ...mockDashboard,
        activeGeneration:
          activeJobMode === "failed"
            ? {
                ...job,
                status: "failed" as const,
                stage: "failed" as const,
                error: {
                  code: "GENERATION_FAILED" as const,
                  message: "저장소를 읽는 중에 멈췄어요.",
                  retryable: true,
                },
              }
            : job,
      };
    }
    return mockDashboard;
  }

  async getRepositories(query: RepositoryListQuery = {}) {
    await maybeFail("getRepositories");
    await wait();
    /* 처음 로그인한 사람의 상태 — 저장된 목록은 비었지만 GitHub에는 저장소가
       있다. 로그인이 저장소를 가져오지 않으므로 실제로 흔한 상태인데, 목이
       이걸 만들 수 없어서 화면이 늘 차 있는 것처럼 보였다. */
    if (process.env.NEXT_PUBLIC_MOCK_EMPTY_REPOSITORIES) {
      return { repositories: [], nextCursor: null, hasNextPage: false };
    }
    /* =all이면 GitHub에서 가져와도 0건이다. 조직이 앱을 승인하지 않아 조직
       저장소가 통째로 안 보이는 사람이 이 상태다. */
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

    /* 목이 limit을 무시하면 페이지네이션 경로가 로컬에서 한 번도 실행되지
       않는다. 서버와 같은 커서 규칙(오프셋의 base64)을 흉내 낸다. */
    const offset = query.cursor ? Number(atob(query.cursor)) : 0;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const page = repositories.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    const hasNextPage = nextOffset < repositories.length;

    return {
      repositories: page,
      nextCursor: hasNextPage ? btoa(String(nextOffset)) : null,
      hasNextPage,
    };
  }

  async syncRepositories() {
    await maybeFail("syncRepositories");
    await wait(520);
    if (process.env.NEXT_PUBLIC_MOCK_EMPTY_REPOSITORIES === "all") {
      return { repositories: [], syncedAt: new Date().toISOString() };
    }
    return {
      repositories: mockRepositories,
      syncedAt: new Date().toISOString(),
    };
  }

  async getRepository(repositoryId: string) {
    await maybeFail("getRepository");
    await wait(180);
    return (
      mockRepositories.find((repository) => repository.id === repositoryId) ??
      mockRepositories[0]
    );
  }

  async createGeneration(request: CreateGenerationRequest) {
    await maybeFail("createGeneration");
    await wait(420);
    const jobId = `job_${request.repositoryIds.join("_")}`;
    this.generationPollCount.set(jobId, 0);
    this.generationRepositories.set(jobId, request.repositoryIds);
    return this.buildGenerationJob(jobId, 0);
  }

  async getGeneration(jobId: string) {
    await maybeFail("getGeneration");
    await wait(180);
    const current = this.generationPollCount.get(jobId) ?? 0;
    const next = Math.min(current + 1, successfulGenerationScenario.length - 1);
    this.generationPollCount.set(jobId, next);
    return this.buildGenerationJob(jobId, next);
  }

  async retryGeneration(jobId: string) {
    await maybeFail("retryGeneration");
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
    await maybeFail("getPortfolios");
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
    await maybeFail("getPortfolio");
    await wait();
    return {
      ...mockPortfolio,
      id: portfolioId,
      content: this.contentWithAnswers(),
      questions: this.questions(),
    };
  }

  /** 답한 것은 답한 채로 돌려준다. */
  private questions(): PortfolioQuestionDto[] {
    return mockPortfolioQuestions.map((question) => ({
      ...question,
      answer: this.answers.get(question.id) ?? null,
    }));
  }

  /**
   * 답변이 반영된 내용을 만든다.
   *
   * 답한 자리만 채우고 나머지는 원본 객체를 그대로 넘긴다. 목에서도 같은
   * 규칙을 지켜야 화면이 "여기만 바뀌었다"를 실제로 보여줄 수 있다.
   */
  private contentWithAnswers(): PortfolioContentDto {
    if (this.answers.size === 0) return mockPortfolioContent;

    const projects = mockPortfolioContent.projects.map((project) => {
      if (project.id !== "project_signal") return project;
      const next = { ...project };
      for (const question of mockPortfolioQuestions) {
        const answer = this.answers.get(question.id);
        if (!answer) continue;
        if (question.field === "impact") next.impact = [answer];
        if (question.field === "challenges") next.challenges = [answer];
      }
      return next;
    });
    return { ...mockPortfolioContent, projects };
  }

  async applyPortfolioStatements(portfolioId: string, answers: PortfolioAnswerInput[]) {
    await maybeFail("applyPortfolioStatements");
    // 모델 호출이 들어가는 경로라 다른 요청보다 오래 걸린다.
    await wait(900);
    const updatedFields = [];
    for (const entry of answers) {
      const question = mockPortfolioQuestions.find((item) => item.id === entry.questionId);
      if (!question || !entry.answer.trim()) continue;
      this.answers.set(question.id, entry.answer.trim());
      updatedFields.push({ repositoryName: question.repositoryName, field: question.field });
    }
    void portfolioId;
    return {
      content: this.contentWithAnswers(),
      questions: this.questions(),
      updatedFields,
    };
  }

  async updatePortfolioShare(portfolioId: string, published: boolean) {
    await maybeFail("updatePortfolioShare");
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
    await maybeFail("getPublicPortfolio");
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
    await maybeFail("deletePortfolio");
    await wait(260);
    this.deletedPortfolioIds.add(portfolioId);
    return { deletedId: portfolioId };
  }

  async getCredits() {
    await maybeFail("getCredits");
    await wait(160);
    return mockCredits;
  }

  async getBillingProducts() {
    await maybeFail("getBillingProducts");
    await wait();
    return {
      products: mockBillingProducts,
      paymentEnabled: false as const,
      isMock: true as const,
    };
  }

  async createCheckout(request: CreateMockCheckoutRequest) {
    await maybeFail("createCheckout");
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
    await maybeFail("getPayments");
    await wait(180);
    return { payments: mockPayments };
  }

  async getGallery(query: GalleryListQuery = {}) {
    await maybeFail("getGallery");
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
    await maybeFail("getGalleryExample");
    await wait();
    return (
      mockGalleryExamples.find((example) => example.id === exampleId) ??
      mockGalleryExamples[0]
    );
  }

  async getAnnouncements() {
    await maybeFail("getAnnouncements");
    await wait(180);
    return { announcements: mockAnnouncements };
  }

  async getAnnouncement(announcementId: string) {
    await maybeFail("getAnnouncement");
    await wait(180);
    return (
      mockAnnouncementDetails.find(
        (announcement) => announcement.id === announcementId,
      ) ?? mockAnnouncementDetails[0]
    );
  }

  async getTasteSample() {
    await maybeFail("getTasteSample");
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
