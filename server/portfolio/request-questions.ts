import {
  PORTFOLIO_HIGHLIGHT_SLOTS,
  type PortfolioProjectDto,
  type PortfolioQuestionDto,
  type PortfolioQuestionSlot,
} from "@/contracts/api-contract";
import type { PortfolioDecisionCandidateDto } from "@/contracts/api-contract";
import { classifyDecisionTopics, type DecisionTopic } from "@/server/openai/decision-topics";
import { logOperationFailure } from "@/server/observability/api-logging";
import { selectDecisionCandidates } from "@/server/portfolio/decision-candidates";
import { loadGenerationEvidence } from "@/server/portfolio/generation-evidence";
import { getSupabaseClient } from "@/server/supabase/client";
import { getPortfolio } from "@/server/portfolio/portfolios";
import { buildRequestedQuestions } from "@/server/portfolio/questions";
import {
  insertPortfolioQuestions,
  listPortfolioQuestions,
  replacePortfolioQuestions,
} from "@/server/portfolio/statements";

/**
 * 지원자가 직접 빈 자리를 연다.
 *
 * 되묻기 질문은 포트폴리오를 만들 때 초안과 함께 한 번 생긴다. 결정 질문은
 * 세 조각이 같은 topic으로 다 와야 살아남으므로, 모델이 어떤 저장소에 대해
 * 묶음을 내지 않으면 그 프로젝트의 핵심 결정은 영영 빈 채로 남았다. 생성
 * 지침은 "비워두면 나중에 지원자에게 직접 물어볼 수 있다"고 적어놓았는데,
 * 물어볼 통로가 그 모델 호출 안에만 있었다.
 *
 * 모델을 부르지 않고 생성 근거도 읽지 않는다. 그래서 즉시 열리고, 크레딧을
 * 쓰지 않으며, 근거가 남아 있지 않은 오래된 포트폴리오에서도 된다. 답을
 * 반영하는 일은 여전히 근거가 필요하지만, 질문을 여는 일은 아니다.
 */

export type RequestFailure =
  | { kind: "notFound" }
  | { kind: "alreadyFilled" };

/**
 * 그 자리가 실제로 비어 있는지 본다.
 *
 * 채워진 자리를 열어주면 지원자가 성심껏 답해도 병합 단계가 버려 아무것도
 * 바뀌지 않는다. 답을 다 쓴 뒤에야 드러나는 실패라 여기서 막는다 —
 * 질문 선별의 `isOpenSlot`이 하던 것과 같은 판단이다.
 */
export function isOpenSlot(slot: PortfolioQuestionSlot, project: PortfolioProjectDto): boolean {
  return slot === "keyDecision"
    ? project.keyDecision.headline.trim().length === 0
    : project.highlights.length < PORTFOLIO_HIGHLIGHT_SLOTS;
}

export type RequestInput = {
  repositoryName: string;
  slot: PortfolioQuestionSlot;
  /** 어떤 결정에 대해 물을지. 저장소에서 본 그대로의 한 줄이다. */
  topic?: string;
  /** 이미 채워진 결정을 다른 결정으로 바꾼다. */
  replace?: boolean;
};

export async function requestPortfolioQuestions(
  userId: string,
  portfolioId: string,
  input: RequestInput,
): Promise<PortfolioQuestionDto[] | RequestFailure> {
  const { repositoryName, slot, topic, replace } = input;
  /* 소유자 조건이 걸린 조회다. 저장소 목록과 문서를 함께 주므로 이름과
     프로젝트를 잇는 데 따로 질의할 것이 없다. */
  const portfolio = await getPortfolio(userId, portfolioId);
  if (!portfolio) return { kind: "notFound" };

  /* 문서의 프로젝트에는 저장소 이름이 없다. 화면에 필요한 것만 담아
     repositoryUrl만 남기기 때문이다. 저장소 목록을 거쳐 잇는다. */
  const repository = portfolio.repositories.find((item) => item.name === repositoryName);
  const project = repository
    ? portfolio.content.projects.find((item) => item.repositoryUrl === repository.htmlUrl)
    : undefined;
  if (!project) return { kind: "notFound" };

  /* 바꿔 쓰기는 채워진 자리도 연다. 초안이 스스로 고른 결정이 지원자가
     말하고 싶은 결정이 아닐 수 있고, 그때 바꿀 방법이 없었다. */
  const replacing = Boolean(replace) && slot === "keyDecision";
  if (!replacing && !isOpenSlot(slot, project)) return { kind: "alreadyFilled" };

  const asked = buildRequestedQuestions(slot, repositoryName, project.title, topic);

  if (replacing) {
    /* 기존 질문의 답은 다른 결정에 대한 것이라 함께 비운다. 문서의 기존
       결정은 새 답이 셋 다 모일 때까지 그대로 남으므로, 바꾸다 말아도 잃는
       것이 없다. */
    await replacePortfolioQuestions(userId, portfolioId, asked);
  } else {
    /* 같은 자리를 두 번 눌러도 안전하다. `(portfolio_id, repository_name,
       field)` 유니크 인덱스가 있고 삽입이 중복을 무시하므로, 이미 있는 질문은
       답까지 그대로 남는다. */
    await insertPortfolioQuestions(userId, portfolioId, asked);
  }

  return listPortfolioQuestions(portfolioId);
}

/**
 * 저장소에서 찾은 결정 후보 — 모델이 커밋·PR을 주제로 묶은 결과.
 *
 * 제목 나열로는 후보의 질을 보장할 수 없었다. 최근 것만 가져오니 잔버그
 * 수정 제목이 결정 후보로 섰다. 분류는 근거가 바뀌지 않는 한 같으므로
 * generation_evidence.decision_topics에 캐시해 저장소마다 한 번만 부른다.
 *
 * 분류가 안 되면(근거 없음·모델 실패·묶을 것 없음) 제목 나열로 물러난다 —
 * 후보가 나쁜 것과 결정을 못 쓰는 것은 다른 일이다. 실패는 캐시하지 않아
 * 다음에 다시 시도된다.
 */
export async function listDecisionCandidates(
  userId: string,
  portfolioId: string,
  repositoryName: string,
): Promise<PortfolioDecisionCandidateDto[] | RequestFailure> {
  const portfolio = await getPortfolio(userId, portfolioId);
  if (!portfolio) return { kind: "notFound" };
  if (!portfolio.repositories.some((item) => item.name === repositoryName)) {
    return { kind: "notFound" };
  }

  const evidence = await loadGenerationEvidence(portfolio.generationJobId);
  const repository = evidence?.repositories.find((item) => item.name === repositoryName);
  if (!repository) return [];

  const cached = await readTopicCache(portfolio.generationJobId, repositoryName);
  if (cached) return cached.map(toCandidate);

  try {
    const topics = await classifyDecisionTopics(repository);
    if (topics.length > 0) {
      await writeTopicCache(portfolio.generationJobId, repositoryName, topics);
      return topics.map(toCandidate);
    }
  } catch (error) {
    /* 분류 실패로 결정 쓰기를 막지 않는다. 로그만 남기고 나열로 물러난다. */
    logOperationFailure({
      domain: "portfolios",
      operation: "decisionTopics.classify",
      jobId: portfolio.generationJobId,
      error: error instanceof Error ? error : new Error("Unable to classify decision topics."),
    });
  }

  return selectDecisionCandidates(repository);
}

function toCandidate(topic: DecisionTopic): PortfolioDecisionCandidateDto {
  return { topic: topic.title, summary: topic.summary || null, evidence: topic.evidence, source: "analysis" };
}

type TopicCacheRow = { decision_topics: Record<string, DecisionTopic[]> | null };

async function readTopicCache(
  generationJobId: string,
  repositoryName: string,
): Promise<DecisionTopic[] | null> {
  const { data, error } = await getSupabaseClient()
    .from("generation_evidence")
    .select("decision_topics")
    .eq("generation_job_id", generationJobId)
    .maybeSingle();
  if (error) throw new Error("Unable to load decision topic cache.");

  const cached = (data as TopicCacheRow | null)?.decision_topics?.[repositoryName];
  return Array.isArray(cached) && cached.length > 0 ? cached : null;
}

/**
 * 저장소 하나의 분류를 캐시에 합친다.
 *
 * 열 전체를 덮어쓰되 읽은 값 위에 합치므로, 두 저장소를 거의 동시에 열면
 * 한쪽이 질 수 있다 — 그래도 잃는 것은 캐시뿐이라 다음 호출이 다시 채운다.
 */
async function writeTopicCache(
  generationJobId: string,
  repositoryName: string,
  topics: DecisionTopic[],
): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from("generation_evidence")
    .select("decision_topics")
    .eq("generation_job_id", generationJobId)
    .maybeSingle();
  if (error) return;

  const merged = { ...((data as TopicCacheRow | null)?.decision_topics ?? {}), [repositoryName]: topics };
  await getSupabaseClient()
    .from("generation_evidence")
    .update({ decision_topics: merged })
    .eq("generation_job_id", generationJobId);
}
