import type { PortfolioEvidenceRepository } from "@/server/openai/portfolio-prompt";

/**
 * 모델이 각 프로젝트에 적어 보낸 `repositoryName`으로 원래 저장소를 되찾는다.
 *
 * 저장소가 여러 개면 결과의 `repositoryUrl`이 엉뚱한 저장소를 가리킬 수 있으므로
 * 이 연결이 정확해야 한다. 이름이 어긋나거나 같은 이름이 두 번 오면 아직 쓰이지
 * 않은 저장소를 순서대로 배정해, 어떤 경우에도 저장소가 중복되지 않게 한다.
 */
export function resolveProjectRepositories(
  projects: Array<{ repositoryName?: string }>,
  repositories: PortfolioEvidenceRepository[],
): PortfolioEvidenceRepository[] {
  const byName = new Map(repositories.map((repository) => [repository.name.toLowerCase(), repository]));
  const used = new Set<string>();

  const matched = projects.map((project) => {
    const candidate = byName.get(String(project.repositoryName ?? "").trim().toLowerCase());
    if (candidate && !used.has(candidate.id)) {
      used.add(candidate.id);
      return candidate;
    }
    return null;
  });

  const leftovers = repositories.filter((repository) => !used.has(repository.id));
  return matched.map((repository) => repository ?? leftovers.shift() ?? repositories[0]);
}

/**
 * 여러 저장소의 언어 비율을 하나로 합친다.
 *
 * 저장소마다 자기 안에서 100%가 기준이므로, 그대로 더하면 합이 저장소 수 × 100%가
 * 된다. 저장소 수로 나눠 전체 대비 비중으로 바꾼다.
 */
export function mergeLanguages(
  repositories: PortfolioEvidenceRepository[],
): Array<{ name: string; percentage: number }> {
  const totals = new Map<string, number>();
  for (const repository of repositories) {
    for (const language of repository.languages) {
      totals.set(language.name, (totals.get(language.name) ?? 0) + language.percentage);
    }
  }

  return [...totals.entries()]
    .map(([name, total]) => ({ name, percentage: Number((total / repositories.length).toFixed(1)) }))
    .sort((a, b) => b.percentage - a.percentage);
}
