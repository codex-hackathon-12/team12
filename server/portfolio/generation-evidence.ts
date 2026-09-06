import type { PortfolioEvidence } from "@/server/openai/portfolio-prompt";
import { getSupabaseClient } from "@/server/supabase/client";

/**
 * 생성 근거를 되찾는다.
 *
 * `portfolios.generation_job_id`가 `on delete restrict`라 포트폴리오가 사는
 * 동안 작업은 지워지지 않고, 근거도 그 작업에 묶여 남는다. 그래도 규격 이전에
 * 만든 결과에는 근거 행이 없을 수 있어 없을 때를 다룬다.
 *
 * 되묻기 반영과 결정 후보가 같은 것을 읽으므로 한 곳에 둔다.
 */
export async function loadGenerationEvidence(
  generationJobId: string,
): Promise<PortfolioEvidence | null> {
  const { data, error } = await getSupabaseClient()
    .from("generation_evidence")
    .select("evidence")
    .eq("generation_job_id", generationJobId)
    .maybeSingle();

  if (error) throw new Error("Unable to load generation evidence.");
  return data ? ((data as { evidence: PortfolioEvidence }).evidence) : null;
}
