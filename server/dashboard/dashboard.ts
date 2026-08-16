import type { DashboardDto } from "@/contracts/api-contract";
import { toAuthSessionDto, getSessionUser } from "@/server/auth/session";
import { getMockCreditSummary } from "@/server/billing/mock-catalog";
import { getTasteSample, listRecentAnnouncements } from "@/server/content/catalog";
import { listRecentPortfolioSummaries } from "@/server/portfolio/portfolios";

export async function getDashboardData(request: Request): Promise<DashboardDto> {
  const user = await getSessionUser(request);

  return {
    session: toAuthSessionDto(user),
    credits: getMockCreditSummary(),
    tasteSample: getTasteSample(),
    recentPortfolios: user ? await listRecentPortfolioSummaries(user.id) : [],
    announcements: listRecentAnnouncements(3),
  };
}
