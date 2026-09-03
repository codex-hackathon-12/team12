import type {
  PortfolioDto,
  PortfolioShareDto,
  PortfolioSummaryDto,
  PublicPortfolioDto,
} from "@/contracts/api-contract";
import {
  mapPortfolio,
  mapPortfolioSummary,
  mapPublicPortfolio,
  type PortfolioRecord,
} from "@/server/portfolio/mapper";
import { buildPortfolioSlug, toShareDto } from "@/server/portfolio/sharing";
import { listPortfolioQuestions } from "@/server/portfolio/statements";
import { getSupabaseClient } from "@/server/supabase/client";

const PORTFOLIO_SELECT = "id, generation_job_id, title, target_role, content, style, public_slug, published_at, created_at, updated_at, repositories!portfolios_repository_id_fkey(id, github_repository_id, owner_username, owner_avatar_url, name, full_name, description, html_url, default_branch, primary_language, visibility, star_count, fork_count, pushed_at, synced_at), portfolio_repositories(position, repositories(id, github_repository_id, owner_username, owner_avatar_url, name, full_name, description, html_url, default_branch, primary_language, visibility, star_count, fork_count, pushed_at, synced_at))";

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

  const portfolio = data ? mapPortfolio(data as PortfolioRecord) : null;
  if (!portfolio) {
    return null;
  }

  /* 질문은 별도 테이블에 있어 조인으로 오지 않는다. 상세 조회에서만 읽는다 —
     목록에는 쓰이지 않아 매번 붙이면 값을 쓰지 않는 질의가 늘어난다. */
  return { ...portfolio, questions: await listPortfolioQuestions(portfolio.id) };
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
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load portfolio for deletion.");
  }

  if (!data) {
    return false;
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

/**
 * 공개 여부를 전환한다. 슬러그는 처음 공개할 때 한 번만 만들고 이후 유지한다.
 * 비공개로 되돌려도 슬러그를 지우지 않아, 다시 공개하면 같은 링크가 살아난다.
 */
export async function updatePortfolioShare(
  userId: string,
  portfolioId: string,
  published: boolean,
  baseUrl: string,
): Promise<PortfolioShareDto | null> {
  const { data, error } = await getSupabaseClient()
    .from("portfolios")
    .select("id, public_slug, published_at, content, target_role")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load portfolio for sharing.");
  }

  if (!data) {
    return null;
  }

  const content = data.content as { profile?: { displayName?: string } } | null;
  /* 공개할 때만 슬러그를 만든다. 비공개 전환에서 슬러그를 새로 찍으면
     "슬러그가 있다"가 공개된 적이 있다는 뜻이 아니게 되어 나중에 추적이 어렵다. */
  const slug = data.public_slug
    ?? (published ? buildPortfolioSlug(content?.profile?.displayName, data.target_role) : null);

  const { data: updated, error: updateError } = await getSupabaseClient()
    .from("portfolios")
    .update({
      public_slug: slug,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .select("public_slug, published_at")
    .single();

  if (updateError || !updated) {
    throw new Error("Unable to update portfolio sharing.");
  }

  return toShareDto(updated, baseUrl);
}

/**
 * 공개 페이지용 조회. 인증이 없는 경로에서 쓰이므로 published_at 조건이 반드시 필요하다.
 * 이 조건이 빠지면 비공개 포트폴리오까지 슬러그만 알면 열람된다.
 */
export async function getPublicPortfolio(slug: string): Promise<PublicPortfolioDto | null> {
  const { data, error } = await getSupabaseClient()
    .from("portfolios")
    .select(PORTFOLIO_SELECT)
    .eq("public_slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load public portfolio.");
  }

  return data ? mapPublicPortfolio(data as PortfolioRecord, slug) : null;
}
