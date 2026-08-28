import type {
  GitRepositoryDto,
  PortfolioContentDto,
  PortfolioDto,
  PortfolioSummaryDto,
} from "@/contracts/api-contract";

export type PortfolioRepositoryRecord = {
  id: string;
  github_repository_id: number | string;
  owner_username: string;
  owner_avatar_url: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  primary_language: string | null;
  visibility: "public" | "private";
  star_count: number;
  fork_count: number;
  pushed_at: string;
  synced_at: string;
};

export type PortfolioLinkRecord = {
  position: number;
  repositories: PortfolioRepositoryRecord | PortfolioRepositoryRecord[] | null;
};

export type PortfolioRecord = {
  id: string;
  generation_job_id: string;
  title: string;
  target_role: string;
  content: unknown;
  style: string;
  resume_pdf_path: string | null;
  resume_pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
  repositories: PortfolioRepositoryRecord | PortfolioRepositoryRecord[] | null;
  portfolio_repositories?: PortfolioLinkRecord[] | null;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// 결과 화면이 감당할 수 있는 분량 상한. 생성 스키마와 같은 값을 쓰며,
// 모델이 상한을 어기거나 규격 이전에 저장된 결과를 열어도 화면이 무너지지 않게 한다.
const CONTENT_LIMITS = {
  skillGroups: 4,
  skillsPerGroup: 6,
  techStack: 8,
  highlights: 3,
  challenges: 2,
  solutions: 2,
  impact: 2,
  notablePatterns: 4,
} as const;

function readStringArray(value: unknown, limit?: number): string[] {
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return limit === undefined ? items : items.slice(0, limit);
}

// 조인 결과가 비어 있으면 대표 저장소 하나로 대체한다.
// 규격 이전에 저장된 포트폴리오도 같은 모양으로 보이게 하기 위함이다.
function readLinkedRepositories(record: PortfolioRecord): PortfolioRepositoryRecord[] {
  const links = Array.isArray(record.portfolio_repositories) ? record.portfolio_repositories : [];
  const linked = [...links]
    .sort((a, b) => a.position - b.position)
    .flatMap((link) => {
      const value = link.repositories;
      if (!value) return [];
      return Array.isArray(value) ? value.slice(0, 1) : [value];
    });

  if (linked.length > 0) {
    return linked;
  }

  const primary = readRepository(record);
  return primary ? [primary] : [];
}

function readRepository(record: PortfolioRecord): PortfolioRepositoryRecord | null {
  if (Array.isArray(record.repositories)) {
    return record.repositories[0] ?? null;
  }
  return record.repositories;
}

function mapSkills(value: unknown): PortfolioContentDto["skills"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, CONTENT_LIMITS.skillGroups).flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    return [{
      category: readString(item.category),
      skills: readStringArray(item.skills, CONTENT_LIMITS.skillsPerGroup),
    }];
  });
}

function mapProjects(
  value: unknown,
  repository: GitRepositoryDto,
  targetRole: string,
): PortfolioContentDto["projects"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    return [{
      id: readString(item.id, `project-${index + 1}`),
      title: readString(item.title),
      description: readString(item.description),
      repositoryUrl: readString(item.repositoryUrl, repository.htmlUrl),
      role: readString(item.role, targetRole),
      techStack: readStringArray(item.techStack, CONTENT_LIMITS.techStack),
      highlights: readStringArray(item.highlights, CONTENT_LIMITS.highlights),
      challenges: readStringArray(item.challenges, CONTENT_LIMITS.challenges),
      solutions: readStringArray(item.solutions, CONTENT_LIMITS.solutions),
      impact: readStringArray(item.impact, CONTENT_LIMITS.impact),
    }];
  });
}

function mapLanguages(value: unknown): PortfolioContentDto["gitAnalysis"]["languages"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== "string" || item.name.trim().length === 0) {
      return [];
    }

    return [{ name: item.name, percentage: readNumber(item.percentage) }];
  });
}

export function mapRepository(record: PortfolioRepositoryRecord): GitRepositoryDto {
  return {
    id: record.id,
    githubRepositoryId: String(record.github_repository_id),
    owner: {
      username: record.owner_username,
      avatarUrl: record.owner_avatar_url,
    },
    name: record.name,
    fullName: record.full_name,
    description: record.description,
    htmlUrl: record.html_url,
    defaultBranch: record.default_branch,
    primaryLanguage: record.primary_language,
    visibility: record.visibility,
    starCount: record.star_count,
    forkCount: record.fork_count,
    pushedAt: record.pushed_at,
    syncedAt: record.synced_at,
  };
}

export function mapPortfolioContent(
  content: unknown,
  repository: GitRepositoryDto,
  targetRole: string,
): PortfolioContentDto {
  const source = isRecord(content) ? content : {};
  const profile = isRecord(source.profile) ? source.profile : {};
  const gitAnalysis = isRecord(source.gitAnalysis) ? source.gitAnalysis : {};
  const contact = isRecord(source.contact) ? source.contact : {};

  return {
    profile: {
      displayName: readString(profile.displayName),
      headline: readString(profile.headline),
      targetRole: readString(profile.targetRole, targetRole),
      avatarUrl: readNullableString(profile.avatarUrl),
    },
    introduction: readString(source.introduction),
    skills: mapSkills(source.skills),
    projects: mapProjects(source.projects, repository, targetRole),
    gitAnalysis: {
      summary: readString(gitAnalysis.summary),
      primaryLanguage: readNullableString(gitAnalysis.primaryLanguage),
      languages: mapLanguages(gitAnalysis.languages),
      starCount: readNumber(gitAnalysis.starCount),
      forkCount: readNumber(gitAnalysis.forkCount),
      notablePatterns: readStringArray(gitAnalysis.notablePatterns, CONTENT_LIMITS.notablePatterns),
    },
    contact: {
      githubUrl: readString(contact.githubUrl, repository.htmlUrl),
      email: readNullableString(contact.email),
      location: readNullableString(contact.location),
    },
  };
}

export function extractTechStack(content: PortfolioContentDto): string[] {
  const values = [
    ...content.gitAnalysis.languages.map((language) => language.name),
    ...content.projects.flatMap((project) => project.techStack),
    ...content.skills.flatMap((skillGroup) => skillGroup.skills),
  ];
  const unique = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique].slice(0, 12);
}

export function mapPortfolioSummary(record: PortfolioRecord): PortfolioSummaryDto | null {
  const repositoryRecord = readRepository(record);
  if (!repositoryRecord) {
    return null;
  }

  const repository = mapRepository(repositoryRecord);
  const content = mapPortfolioContent(record.content, repository, record.target_role);
  return {
    id: record.id,
    title: record.title,
    targetRole: record.target_role,
    repositoryName: repository.name,
    repositoryCount: Math.max(readLinkedRepositories(record).length, 1),
    techStack: extractTechStack(content),
    createdAt: record.created_at,
  };
}

export function mapPortfolio(record: PortfolioRecord): PortfolioDto | null {
  const summary = mapPortfolioSummary(record);
  const repositoryRecord = readRepository(record);
  if (!summary || !repositoryRecord) {
    return null;
  }

  const repository = mapRepository(repositoryRecord);
  const linked = readLinkedRepositories(record).map(mapRepository);
  return {
    ...summary,
    generationJobId: record.generation_job_id,
    repository,
    repositories: linked.length > 0 ? linked : [repository],
    style: "default",
    resumePdf: record.resume_pdf_path
      ? {
          downloadUrl: `/api/v1/portfolios/${record.id}/resume.pdf`,
          generatedAt: record.resume_pdf_generated_at ?? record.updated_at,
        }
      : null,
    content: mapPortfolioContent(record.content, repository, record.target_role),
    updatedAt: record.updated_at,
  };
}

export function encodePortfolioCursor(offset: number | null): string | null {
  return offset === null ? null : btoa(String(offset));
}

export function decodePortfolioCursor(value: string | null): number {
  if (!value) {
    return 0;
  }

  try {
    const offset = Number(atob(value));
    return Number.isInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}
