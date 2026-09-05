import { getOpenAIEnvironment } from "@/server/config/env";
import { TIMEOUTS, fetchWithTimeout } from "@/server/net/fetch";
import { buildRewritePrompt, type RewriteRequest } from "@/server/openai/rewrite-prompt";
import type { ProjectRewrite } from "@/server/portfolio/rewrite";

/**
 * 되묻기 답변을 반영한 항목을 모델에게 받는다.
 *
 * 초안 생성과 같은 방식이지만 훨씬 좁은 스키마를 쓴다. 제목, 헤드라인, 소개,
 * 역량, 기술 스택이 스키마에 아예 없으므로 모델이 그것을 바꿀 통로가 없다.
 */

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["projects"],
  properties: {
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["repositoryName", "role", "highlights", "keyDecision"],
        properties: {
          repositoryName: { type: "string" },
          role: { type: "string" },
          highlights: { type: "array", maxItems: 4, items: { type: "string" } },
          keyDecision: {
            type: "object",
            additionalProperties: false,
            required: ["headline", "problem", "approach", "outcome"],
            properties: {
              headline: { type: "string" },
              problem: { type: "string" },
              approach: { type: "string" },
              outcome: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

function extractOutputText(response: unknown): string {
  const output = (response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output;
  const text = output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI response did not contain structured output.");
  return text;
}

export async function generatePortfolioRewrite(request: RewriteRequest): Promise<ProjectRewrite[]> {
  const configuration = getOpenAIEnvironment();
  const prompt = buildRewritePrompt(request);
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${configuration.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: configuration.model,
        instructions: prompt.instructions,
        input: prompt.input,
        text: { format: { type: "json_schema", name: "portfolio_rewrite", strict: true, schema } },
      }),
    },
    TIMEOUTS.openai,
  );
  if (!response.ok) {
    const failure = new Error(`OpenAI rewrite failed with status ${response.status}.`);
    failure.name = "OpenAIResponseError";
    throw failure;
  }

  const parsed = JSON.parse(extractOutputText(await response.json())) as { projects?: unknown };
  if (!Array.isArray(parsed.projects)) {
    const failure = new Error("OpenAI rewrite did not match the schema.");
    failure.name = "OpenAISchemaError";
    throw failure;
  }
  /* 여기서는 모양만 본다. 무엇을 반영할지는 병합 단계가 정한다. */
  return parsed.projects as ProjectRewrite[];
}
