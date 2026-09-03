import { getOpenAIEnvironment } from "@/server/config/env";
import { TIMEOUTS, fetchWithTimeout } from "@/server/net/fetch";
import { buildPortfolioPrompt, type PortfolioEvidence } from "@/server/openai/portfolio-prompt";

export type { PortfolioEvidence } from "@/server/openai/portfolio-prompt";

export type GeneratedPortfolioDraft = {
  title: string;
  headline: string;
  introduction: string;
  skills: Array<{ category: string; skills: string[] }>;
  /** 커밋과 PR 제목에서 드러나는 작업 방식. 저장소 전체를 아우른다. */
  notablePatterns: string[];
  projects: Array<{
    title: string;
    description: string;
    /** 이 프로젝트가 근거로 삼은 저장소의 name. 결과를 저장소에 다시 연결할 때 쓴다. */
    repositoryName: string;
    role: string;
    techStack: string[];
    highlights: string[];
    challenges: string[];
    solutions: string[];
    impact: string[];
  }>;
  /**
   * 근거가 없어 비운 자리에 대해 지원자에게 되묻는 질문.
   *
   * 빈칸을 그럴듯하게 메우는 대신 만든 사람에게 묻는다. 무엇을 왜 비웠는지
   * 가장 잘 아는 것이 방금 그것을 비운 이 호출이라, 별도 호출로 나누지 않고
   * 같은 응답에서 받는다.
   */
  followUpQuestions: Array<{
    repositoryName: string;
    field: "impact" | "challenges" | "solutions" | "role" | "highlights";
    question: string;
  }>;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "headline", "introduction", "skills", "projects", "notablePatterns", "followUpQuestions"],
  properties: {
    title: { type: "string" },
    headline: { type: "string" },
    introduction: { type: "string" },
    skills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "skills"],
        properties: {
          category: { type: "string" },
          skills: { type: "array", maxItems: 8, items: { type: "string" } },
        },
      },
      maxItems: 5,
    },
    projects: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "repositoryName", "role", "techStack", "highlights", "challenges", "solutions", "impact"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          repositoryName: { type: "string" },
          role: { type: "string" },
          techStack: { type: "array", maxItems: 10, items: { type: "string" } },
          highlights: { type: "array", maxItems: 4, items: { type: "string" } },
          challenges: { type: "array", maxItems: 3, items: { type: "string" } },
          solutions: { type: "array", maxItems: 3, items: { type: "string" } },
          impact: { type: "array", maxItems: 3, items: { type: "string" } },
        },
      },
    },
    notablePatterns: { type: "array", maxItems: 4, items: { type: "string" } },
    followUpQuestions: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["repositoryName", "field", "question"],
        properties: {
          repositoryName: { type: "string" },
          field: { type: "string", enum: ["impact", "challenges", "solutions", "role", "highlights"] },
          question: { type: "string" },
        },
      },
    },
  },
} as const;

function getConfiguration(): { apiKey: string; model: string } {
  return getOpenAIEnvironment();
}

function extractOutputText(response: unknown): string {
  const output = (response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output;
  const text = output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI response did not contain structured output.");
  return text;
}

function isDraft(value: unknown): value is GeneratedPortfolioDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.title === "string"
    && typeof draft.headline === "string"
    && typeof draft.introduction === "string"
    && Array.isArray(draft.skills)
    && Array.isArray(draft.projects)
    && draft.projects.length > 0
    && Array.isArray(draft.notablePatterns);
}

/**
 * 질문이 없다고 생성을 실패시키지 않는다.
 *
 * 되묻기는 결과를 더 좋게 만드는 보조 기능이고, 포트폴리오 본문은 질문 없이도
 * 온전하다. 여기서 던지면 질문 하나 때문에 완성된 초안을 통째로 버리게 된다.
 */
function readQuestions(value: unknown): GeneratedPortfolioDraft["followUpQuestions"] {
  return Array.isArray(value)
    ? (value as GeneratedPortfolioDraft["followUpQuestions"])
    : [];
}

export async function generatePortfolioDraft(evidence: PortfolioEvidence): Promise<GeneratedPortfolioDraft> {
  const configuration = getConfiguration();
  const prompt = buildPortfolioPrompt(evidence);
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${configuration.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: configuration.model,
        instructions: prompt.instructions,
        input: prompt.input,
        text: { format: { type: "json_schema", name: "portfolio_draft", strict: true, schema } },
      }),
    },
    TIMEOUTS.openai,
  );
  if (!response.ok) {
    const failure = new Error(`OpenAI response failed with status ${response.status}.`);
    failure.name = "OpenAIResponseError";
    throw failure;
  }
  const draft = JSON.parse(extractOutputText(await response.json()));
  if (!isDraft(draft)) {
    const failure = new Error("OpenAI output did not match the portfolio schema.");
    failure.name = "OpenAISchemaError";
    throw failure;
  }
  return { ...draft, followUpQuestions: readQuestions(draft.followUpQuestions) };
}
