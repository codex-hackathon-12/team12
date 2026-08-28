import type { PortfolioDto, PortfolioSummaryDto } from "@/contracts/api-contract";
import {
  mapPortfolio,
  mapPortfolioSummary,
  type PortfolioRecord,
} from "@/server/portfolio/mapper";
import { logOperationFailure } from "@/server/observability/api-logging";
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

/**
 * 포트폴리오를 영구 삭제한다. 되돌릴 수 없다.
 *
 * 생성 작업 기록은 남는다. `generation_jobs.portfolio_id`가 `on delete set null`이라
 * 자동으로 비워지고, `portfolio_repositories`는 cascade로 함께 지워진다.
 *
 * 소유자가 아니거나 없는 포트폴리오면 `false`를 돌려준다.
 */
export async function deletePortfolio(userId: string, portfolioId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from("portfolios")
    .select("id, resume_pdf_path")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load portfolio for deletion.");
  }

  if (!data) {
    return false;
  }

  // PDF를 먼저 지운다. 여기서 실패해도 삭제 자체는 진행한다.
  // 사용자에게는 삭제가 끝난 것으로 보이는 편이 낫고, 남은 파일은 따로 정리할 수 있다.
  if (data.resume_pdf_path) {
    const { error: storageError } = await getSupabaseClient()
      .storage
      .from("resumes")
      .remove([data.resume_pdf_path]);

    if (storageError) {
      logOperationFailure({
        domain: "portfolios",
        operation: "portfolio.delete.storage",
        portfolioId,
        error: storageError,
      });
    }
  }

  const { error: deleteError } = await getSupabaseClient()
    .from("portfolios")
    .delete()
    .eq("id", portfolioId)
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error("Unable to delete portfolio.");
  }

  return true;
}
