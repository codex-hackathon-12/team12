import { env } from "cloudflare:workers";

type OpenAIEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type PortfolioEvidence = {
  repository: {
    name: string;
    description: string | null;
    url: string;
    primaryLanguage: string | null;
    starCount: number;
    forkCount: number;
  };
  targetRole: string;
  prompt: string;
  highlights: string[];
  languages: Array<{ name: string; percentage: number }>;
  readme: string;
  commitTitles: string[];
  pullRequestTitles: string[];
};

export type GeneratedPortfolioDraft = {
  title: string;
  headline: string;
  introduction: string;
  skills: Array<{ category: string; skills: string[] }>;
  projects: Array<{
    title: string;
    description: string;
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
  required: ["title", "headline", "introduction", "skills", "projects"],
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
        properties: { category: { type: "string" }, skills: { type: "array", items: { type: "string" } } },
      },
    },
    projects: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "role", "techStack", "highlights", "challenges", "solutions", "impact"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          role: { type: "string" },
          techStack: { type: "array", items: { type: "string" } },
          highlights: { type: "array", items: { type: "string" } },
          challenges: { type: "array", items: { type: "string" } },
          solutions: { type: "array", items: { type: "string" } },
          impact: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

function getConfiguration(): { apiKey: string; model: string } {
  const configuration = env as OpenAIEnv;
  if (!configuration.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is unavailable.");
  }
  return { apiKey: configuration.OPENAI_API_KEY, model: configuration.OPENAI_MODEL || "gpt-5.6-luna" };
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
    && draft.projects.length > 0;
}

export async function generatePortfolioDraft(evidence: PortfolioEvidence): Promise<GeneratedPortfolioDraft> {
  const configuration = getConfiguration();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${configuration.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: configuration.model,
      instructions: "당신은 취업 포트폴리오 작성 도우미입니다. 반드시 한국어로 작성하세요. 제공된 근거에 없는 수치, 역할, 기술, 성과를 만들지 마세요. 불확실하면 일반적인 표현을 사용하고 빈 배열을 반환하세요.",
      input: JSON.stringify(evidence),
      text: { format: { type: "json_schema", name: "portfolio_draft", strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI response failed with status ${response.status}.`);
  const draft = JSON.parse(extractOutputText(await response.json()));
  if (!isDraft(draft)) throw new Error("OpenAI output did not match the portfolio schema.");
  return draft;
}
