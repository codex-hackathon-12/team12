import { getOpenAIEnvironment } from "@/server/config/env";
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
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "headline", "introduction", "skills", "projects", "notablePatterns"],
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

export async function generatePortfolioDraft(evidence: PortfolioEvidence): Promise<GeneratedPortfolioDraft> {
  const configuration = getConfiguration();
  const prompt = buildPortfolioPrompt(evidence);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${configuration.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: configuration.model,
      instructions: prompt.instructions,
      input: prompt.input,
      text: { format: { type: "json_schema", name: "portfolio_draft", strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI response failed with status ${response.status}.`);
  const draft = JSON.parse(extractOutputText(await response.json()));
  if (!isDraft(draft)) throw new Error("OpenAI output did not match the portfolio schema.");
  return draft;
}
