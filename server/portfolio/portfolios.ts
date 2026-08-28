import type { PortfolioDto, PortfolioSummaryDto } from "@/contracts/api-contract";
import {
  mapPortfolio,
  mapPortfolioSummary,
  type PortfolioRecord,
} from "@/server/portfolio/mapper";
import { getSupabaseClient } from "@/server/supabase/client";

const PORTFOLIO_SELECT = "id, generation_job_id, title, target_role, content, style, resume_pdf_path, resume_pdf_generated_at, created_at, updated_at, repositories(id, github_repository_id, owner_username, owner_avatar_url, name, full_name, description, html_url, default_branch, primary_language, visibility, star_count, fork_count, pushed_at, synced_at), portfolio_repositories(position, repositories(id, github_repository_id, owner_username, owner_avatar_url, name, full_name, description, html_url, default_branch, primary_language, visibility, star_count, fork_count, pushed_at, synced_at))";

type ListOptions = {
  limit: number;
  offset?: number;
};

type PortfolioListResult = {
  portfolios: PortfolioSummaryDto[];
  hasNextPage: boolean;
  nextOffset: number | null;
};

function normalizeLimit(limit: number): number {
  return Math.min(Math.max(Math.floor(limit), 1), 50);
}

export async function listPortfolios(
  userId: string,
  options: ListOptions,
): Promise<PortfolioListResult> {
  const limit = normalizeLimit(options.limit);
  const offset = Math.max(Math.floor(options.offset ?? 0), 0);
  const { data, error } = await getSupabaseClient()
    .from("portfolios")
    .select(PORTFOLIO_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    throw new Error("Unable to load portfolios.");
  }

  const records = (data ?? []) as PortfolioRecord[];
  const hasNextPage = records.length > limit;
  return {
    portfolios: records
      .slice(0, limit)
      .map(mapPortfolioSummary)
      .filter((portfolio): portfolio is PortfolioSummaryDto => portfolio !== null),
    hasNextPage,
    nextOffset: hasNextPage ? offset + limit : null,
  };
}

export async function listRecentPortfolioSummaries(
  userId: string,
  limit = 3,
): Promise<PortfolioSummaryDto[]> {
  const result = await listPortfolios(userId, { limit, offset: 0 });
  return result.portfolios;
}

export async function getPortfolio(
  userId: string,
  portfolioId: string,
): Promise<PortfolioDto | null> {
  const { data, error } = await getSupabaseClient()
    .from("portfolios")
    .select(PORTFOLIO_SELECT)
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load portfolio.");
  }

  return data ? mapPortfolio(data as PortfolioRecord) : null;
}

