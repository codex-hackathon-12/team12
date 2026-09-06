import type { PortfolioQuestionDto, PortfolioStatementField } from "@/contracts/api-contract";
import { getSupabaseClient } from "@/server/supabase/client";

/**
 * 되묻기 질문과 답변의 저장소 계층.
 *
 * 근거 테이블(`generation_evidence`)에 얹지 않고 따로 둔다. 그쪽은 생성 작업에
 * cascade로 묶인 파이프라인 중간 산출물이고, 답변은 포트폴리오가 사는 동안
 * 살아야 하는 사용자 데이터다. 수명이 다른 것을 한 행에 두면 한쪽을 지울 때
 * 다른 쪽이 함께 사라진다.
 */

export type StatementRecord = {
  id: string;
  repository_name: string | null;
  field: PortfolioStatementField;
  /** 같은 결정에 속한 질문들이 공유하는 한 줄. 낱개 질문은 null이다. */
  topic: string | null;
  question: string;
  answer: string | null;
};

const COLUMNS = "id, repository_name, field, topic, question, answer";

function toDto(record: StatementRecord): PortfolioQuestionDto {
  return {
    id: record.id,
    repositoryName: record.repository_name,
    field: record.field,
    topic: record.topic,
    question: record.question,
    answer: record.answer,
  };
}

export async function listPortfolioQuestions(portfolioId: string): Promise<PortfolioQuestionDto[]> {
  const { data, error } = await getSupabaseClient()
    .from("portfolio_statements")
    .select(COLUMNS)
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load portfolio questions.");
  }

  return ((data ?? []) as StatementRecord[]).map(toDto);
}

/**
 * 여러 포트폴리오의 질문을 한 번에 읽는다. 목록 화면이 N+1로 부르지 않게 한다.
 */
export async function listQuestionsByPortfolio(
  portfolioIds: string[],
): Promise<Map<string, PortfolioQuestionDto[]>> {
  const grouped = new Map<string, PortfolioQuestionDto[]>();
  if (portfolioIds.length === 0) {
    return grouped;
  }

  const { data, error } = await getSupabaseClient()
    .from("portfolio_statements")
    .select(`portfolio_id, ${COLUMNS}`)
    .in("portfolio_id", portfolioIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load portfolio questions.");
  }

  for (const row of (data ?? []) as Array<StatementRecord & { portfolio_id: string }>) {
    const list = grouped.get(row.portfolio_id) ?? [];
    list.push(toDto(row));
    grouped.set(row.portfolio_id, list);
  }
  return grouped;
}

export type NewQuestion = {
  repositoryName: string | null;
  field: PortfolioStatementField;
  topic: string | null;
  question: string;
};

/**
 * 생성 직후 질문을 남긴다.
 *
 * 질문 저장이 실패해도 포트폴리오 생성 자체는 성공으로 둔다. 되묻기는 결과를
 * 더 좋게 만드는 보조 기능이고, 여기서 던지면 완성된 포트폴리오를 저장하고도
 * 작업 전체가 실패로 표시된다.
 */
export async function insertPortfolioQuestions(
  userId: string,
  portfolioId: string,
  questions: NewQuestion[],
): Promise<void> {
  if (questions.length === 0) {
    return;
  }

  await getSupabaseClient()
    .from("portfolio_statements")
    .upsert(
      questions.map((question) => ({
        portfolio_id: portfolioId,
        user_id: userId,
        repository_name: question.repositoryName,
        field: question.field,
        topic: question.topic,
        question: question.question,
      })),
      { onConflict: "portfolio_id,repository_name,field", ignoreDuplicates: true },
    );
}

/**
 * 이미 있는 질문을 다른 것으로 바꾼다.
 *
 * 초안이 스스로 고른 결정을 지원자가 다른 결정으로 바꿀 때 쓴다. 같은 자리
 * (`portfolio_id, repository_name, field`)를 덮어쓰므로 유니크 인덱스와
 * 충돌하지 않고, 한 프로젝트에 결정은 하나라는 제약도 그대로 지켜진다.
 *
 * **답을 함께 비운다.** 지난 답은 다른 결정에 대한 것이라 새 결정에 붙이면
 * 두 이야기가 섞인다. 문서의 기존 결정은 새 답이 셋 다 모일 때까지 그대로
 * 남으므로, 바꾸다 말아도 잃는 것이 없다.
 */
export async function replacePortfolioQuestions(
  userId: string,
  portfolioId: string,
  questions: NewQuestion[],
): Promise<void> {
  if (questions.length === 0) {
    return;
  }

  const { error } = await getSupabaseClient()
    .from("portfolio_statements")
    .upsert(
      questions.map((question) => ({
        portfolio_id: portfolioId,
        user_id: userId,
        repository_name: question.repositoryName,
        field: question.field,
        topic: question.topic,
        question: question.question,
        answer: null,
      })),
      { onConflict: "portfolio_id,repository_name,field" },
    );

  if (error) {
    throw new Error("Unable to replace portfolio questions.");
  }
}

/**
 * 답변을 기록한다. 답한 뒤 다시 답하면 마지막 답이 남는다.
 *
 * 소유자 조건을 UPDATE의 WHERE에 함께 건다. 조회로 확인한 뒤 조건 없이 쓰면
 * 그 사이에 소유자가 바뀔 수 있는 창이 생긴다.
 */
export async function saveAnswers(
  userId: string,
  portfolioId: string,
  answers: Array<{ questionId: string; answer: string }>,
): Promise<PortfolioQuestionDto[]> {
  const saved: PortfolioQuestionDto[] = [];

  for (const entry of answers) {
    const { data, error } = await getSupabaseClient()
      .from("portfolio_statements")
      .update({ answer: entry.answer })
      .eq("id", entry.questionId)
      .eq("portfolio_id", portfolioId)
      .eq("user_id", userId)
      .select(COLUMNS)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to save portfolio answer.");
    }
    if (data) {
      saved.push(toDto(data as StatementRecord));
    }
  }

  return saved;
}
