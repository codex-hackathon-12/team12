import type {
  PortfolioContentDto,
  PortfolioQuestionDto,
  PortfolioStatementResultDto,
} from "@/contracts/api-contract";
import { generatePortfolioRewrite } from "@/server/openai/portfolio-rewriter";
import { buildPortfolioPrompt, type PortfolioEvidence } from "@/server/openai/portfolio-prompt";
import type { RewriteProjectSnapshot, RewriteStatement } from "@/server/openai/rewrite-prompt";
import { mapPortfolioContent, mapRepository, type PortfolioRecord } from "@/server/portfolio/mapper";
import {
  applyRewrite,
  isRewritableField,
  type ProjectRewrite,
  type RewriteSlot,
} from "@/server/portfolio/rewrite";
import { buildNumberSet, verifyNarrative } from "@/server/portfolio/verification";
import { listPortfolioQuestions, saveAnswers } from "@/server/portfolio/statements";
import { getSupabaseClient } from "@/server/supabase/client";

/**
 * 되묻기 답변을 받아 그 자리만 다시 쓴다.
 *
 * 새 생성 작업을 만들지 않는다. 사용자당 활성 작업 1개 제한과 애초에 충돌하지
 * 않고, 크레딧도 쓰지 않으며, 되돌아올 폴링 화면도 필요 없다. 되묻기는 이미
 * 만든 결과를 손보는 일이지 다시 만드는 일이 아니다.
 */

export type ApplyFailure =
  | { kind: "notFound" }
  | { kind: "evidenceUnavailable" }
  | { kind: "noAnswers" };

const PORTFOLIO_SELECT =
  "id, generation_job_id, title, target_role, content, style, public_slug, published_at, created_at, updated_at, repositories!portfolios_repository_id_fkey(id, github_repository_id, owner_username, owner_avatar_url, name, full_name, description, html_url, default_branch, primary_language, visibility, star_count, fork_count, pushed_at, synced_at)";

type Loaded = {
  record: PortfolioRecord;
  content: PortfolioContentDto;
};

async function loadPortfolio(userId: string, portfolioId: string): Promise<Loaded | null> {
  const { data, error } = await getSupabaseClient()
    .from("portfolios")
    .select(PORTFOLIO_SELECT)
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("Unable to load portfolio for rewrite.");
  if (!data) return null;

  const record = data as PortfolioRecord;
  const repositoryRecord = Array.isArray(record.repositories) ? record.repositories[0] : record.repositories;
  if (!repositoryRecord) return null;

  return {
    record,
    content: mapPortfolioContent(record.content, mapRepository(repositoryRecord), record.target_role),
  };
}

/**
 * 생성 근거를 되찾는다.
 *
 * `portfolios.generation_job_id`가 `on delete restrict`라 포트폴리오가 사는 동안
 * 작업은 지워지지 않고, 근거도 그 작업에 묶여 남는다. 그래도 규격 이전에 만든
 * 결과에는 근거 행이 없을 수 있어 없을 때를 다룬다.
 */
async function loadEvidence(generationJobId: string): Promise<PortfolioEvidence | null> {
  const { data, error } = await getSupabaseClient()
    .from("generation_evidence")
    .select("evidence")
    .eq("generation_job_id", generationJobId)
    .maybeSingle();

  if (error) throw new Error("Unable to load generation evidence.");
  return data ? ((data as { evidence: PortfolioEvidence }).evidence) : null;
}

/** 근거 어디에도 없는 숫자가 든 문장을 걷어낸다. role은 문장이 아니라 구절이라 그대로 둔다. */
function sanitizeRewrite(rewrite: ProjectRewrite, numbers: Set<string>): ProjectRewrite {
  const clean = (values: unknown) =>
    verifyNarrative(Array.isArray(values) ? values.filter((v): v is string => typeof v === "string") : [], numbers).value;
  return {
    ...rewrite,
    highlights: clean(rewrite.highlights),
    challenges: clean(rewrite.challenges),
    solutions: clean(rewrite.solutions),
    impact: clean(rewrite.impact),
  };
}

export async function applyPortfolioStatements(
  userId: string,
  portfolioId: string,
  answers: Array<{ questionId: string; answer: string }>,
): Promise<PortfolioStatementResultDto | ApplyFailure> {
  const loaded = await loadPortfolio(userId, portfolioId);
  if (!loaded) return { kind: "notFound" };

  const saved = await saveAnswers(userId, portfolioId, answers);
  // 하나도 저장되지 않았다면 남의 질문 id이거나 이미 지워진 질문이다.
  if (saved.length === 0) return { kind: "notFound" };

  const evidence = await loadEvidence(loaded.record.generation_job_id);
  if (!evidence) return { kind: "evidenceUnavailable" };

  const answered = saved.filter(
    (question): question is PortfolioQuestionDto & { repositoryName: string; answer: string } =>
      Boolean(question.repositoryName) && Boolean(question.answer),
  );
  if (answered.length === 0) return { kind: "noAnswers" };

  /* 답한 자리와 관련된 저장소만 모델에게 넘긴다. 근거를 좁힐수록 지원자의 답이
     수십 KB짜리 README에 묻힐 가능성이 준다. */
  const touched = new Set(answered.map((question) => question.repositoryName));
  const repositories = evidence.repositories.filter((repository) => touched.has(repository.name));
  if (repositories.length === 0) return { kind: "evidenceUnavailable" };

  const urlByName = new Map(evidence.repositories.map((repository) => [repository.name, repository.url]));
  const projects: RewriteProjectSnapshot[] = repositories.flatMap((repository) => {
    const project = loaded.content.projects.find((item) => item.repositoryUrl === repository.url);
    if (!project) return [];
    return [{
      repositoryName: repository.name,
      title: project.title,
      description: project.description,
      role: project.role,
      highlights: project.highlights,
      challenges: project.challenges,
      solutions: project.solutions,
      impact: project.impact,
    }];
  });

  /* 다시 쓸 수 있는 자리만 넘긴다. 병합이 다루지 못하는 field를 프롬프트에만
     실으면 모델은 답을 반영하려 하고 병합은 버려, 사용자에게는 "답했는데
     아무것도 안 바뀌었다"로 보인다. */
  const statements: RewriteStatement[] = answered
    .filter((question) => isRewritableField(question.field))
    .map((question) => ({
      repositoryName: question.repositoryName,
      field: question.field as RewriteSlot["field"],
      question: question.question,
      answer: question.answer,
    }));
  if (statements.length === 0) return { kind: "noAnswers" };
  const slots: RewriteSlot[] = statements.map((statement) => ({
    repositoryName: statement.repositoryName,
    field: statement.field,
  }));

  const rewrites = await generatePortfolioRewrite({
    targetRole: loaded.record.target_role,
    tone: evidence.tone,
    repositories,
    projects,
    statements,
  });

  /* 되묻기도 생성과 같은 수치 검증을 받는다. 여기를 빼면 답변 한 줄을 근거로
     모델이 없던 숫자를 붙일 수 있는 뒷문이 된다. 지원자가 답에 직접 쓴 숫자는
     근거이므로 함께 넘긴다. */
  const numbers = buildNumberSet(
    buildPortfolioPrompt(evidence).input,
    statements.map((statement) => statement.answer),
  );
  const checked = rewrites.map((rewrite) => sanitizeRewrite(rewrite, numbers));

  /* 여기가 "답한 부분만 바뀐다"는 약속을 지키는 자리다. 모델이 요청하지 않은
     자리를 돌려줘도 버린다. 지시는 강제가 아니므로 약속을 지시에 맡기지 않는다. */
  const result = applyRewrite(loaded.content, checked, slots, urlByName);

  if (result.updatedFields.length > 0) {
    const { error } = await getSupabaseClient()
      .from("portfolios")
      .update({ content: result.content })
      .eq("id", portfolioId)
      .eq("user_id", userId);
    if (error) throw new Error("Unable to persist rewritten portfolio.");
  }

  return {
    content: result.content,
    questions: await listPortfolioQuestions(portfolioId),
    updatedFields: result.updatedFields,
  };
}
