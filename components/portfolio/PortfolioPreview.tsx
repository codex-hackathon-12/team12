import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { PaginatedPortfolio } from "@/components/portfolio/PaginatedPortfolio";
import type { PortfolioContentDto, PortfolioProjectDto } from "@/contracts/api-contract";
import { languageColor } from "@/lib/repository-list";

/**
 * 언어 막대의 색.
 *
 * `languageColor`는 모르는 언어에 `var(--line-dark)`를 준다. 저장소 목록의
 * 점에는 맞는 값이지만 이 문서에서는 아니다 — 흰 종이 위에서 2.02:1이라
 * 사실상 보이지 않는다. 팔레트에 없으면 변수를 아예 넘기지 않고, 배경에 맞는
 * 폴백을 CSS가 고르게 둔다.
 */
function accent(language: string): { "--language-color"?: string } {
  const color = languageColor(language);
  return color.startsWith("#") ? { "--language-color": color } : {};
}

// 근거가 없으면 빈 배열이 오므로, 내용이 있는 항목만 열로 만든다.
// 비어 있는 항목까지 라벨을 그리면 채용 담당자에게 빈칸만 보인다.
function storyColumns(project: PortfolioProjectDto): Array<{ label: string; items: string[] }> {
  return [
    { label: "Challenge", items: project.challenges },
    { label: "Approach", items: project.solutions },
    { label: "Impact", items: project.impact },
  ].filter((column) => column.items.length > 0);
}

export function PortfolioPreview({
  content,
  paginated = false,
  onPageCount,
}: {
  content: PortfolioContentDto;
  /** A4 낱장으로 나눠 인쇄 미리보기처럼 보여준다. */
  paginated?: boolean;
  /** 나눠본 장수. 인쇄 전 분량 안내에 쓴다. */
  onPageCount?: (count: number) => void;
}) {
  const initials =
    content.profile.displayName.replace(/\s/gu, "").slice(0, 2).toUpperCase() ||
    "PF";
  const contactHref = content.contact.email
    ? `mailto:${content.contact.email}`
    : content.contact.githubUrl;

  // 여러 프로젝트에 반복 등장하는 기술이 실제 주력이다. 한 번만 쓰인 것과 구분된다.
  const stackCount = new Map<string, number>();
  for (const project of content.projects) {
    for (const tech of new Set(project.techStack)) {
      stackCount.set(tech, (stackCount.get(tech) ?? 0) + 1);
    }
  }
  const coreStack = [...stackCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tech]) => tech);

  const lastActivity = content.gitAnalysis.lastActivityAt
    ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" })
        .format(new Date(content.gitAnalysis.lastActivityAt))
    : null;

  // 인쇄에서 통째로 유지되는 단위와 같은 블록으로 나눈다.
  // 페이지 분할 모드는 이 배열을 A4 낱장에 담고, 아닐 때는 그대로 이어서 그린다.
  const blocks: Array<{ key: string; node: ReactNode; kind?: "project" }> = [];

  blocks.push({ key: "nav", node: (
      <nav className="result-portfolio-nav" aria-label="포트폴리오 목차">
        <a className="result-portfolio-brand" href="#portfolio-top">
          <strong>{content.profile.displayName}</strong>
        </a>
        <div>
          <a href="#portfolio-work">Projects</a>
          <a href="#portfolio-expertise">Skills</a>
        </div>
        <a className="result-nav-contact" href={contactHref}>
          Contact ↗
        </a>
      </nav>
  ) });

  blocks.push({ key: "hero", node: (
      <header className="result-portfolio-hero" id="portfolio-top">
        {/* 사진은 이름 줄에만 붙인다. 아래 문단들은 문서의 기준선에서 시작해야 한다. */}
        <div className="result-hero-identity">
          {content.profile.avatarUrl ? (
            <Image
              className="result-hero-avatar"
              src={content.profile.avatarUrl}
              alt=""
              width={56}
              height={56}
            />
          ) : (
            <div className="result-hero-avatar result-hero-initials" aria-hidden="true">
              {initials}
            </div>
          )}
          <div>
            <p className="result-hero-role">{content.profile.targetRole}</p>
            <h1 className="result-hero-name">{content.profile.displayName}</h1>
          </div>
        </div>

        <div className="result-hero-copy">
          <p className="result-hero-headline">{content.profile.headline}</p>
          <p className="result-hero-description">{content.introduction}</p>

          <div className="result-hero-actions">
            <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            {content.contact.email && (
              <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
            )}
            {content.contact.location && <span>{content.contact.location}</span>}
          </div>
        </div>
      </header>
  ) });

  // 지표는 채용 담당자가 한눈에 판단에 쓰는 것만 남긴다.
  // 프로젝트 수는 아래 카드를 세면 되고, 기술 개수는 많다고 좋은 게 아니며,
  // 별과 fork는 개인 프로젝트에서 대부분 0이라 오히려 약해 보인다.
  const metrics: Array<{ label: string; value: string }> = [];

  if (content.gitAnalysis.primaryLanguage) {
    metrics.push({ label: "Primary language", value: content.gitAnalysis.primaryLanguage });
  }
  if (coreStack.length > 0) {
    metrics.push({ label: "Core stack", value: coreStack.join(" · ") });
  }
  if (lastActivity) {
    metrics.push({ label: "Last activity", value: lastActivity });
  }

  if (metrics.length > 0) {
    blocks.push({ key: "metrics", node: (
      <dl className="result-metric-strip" aria-label="포트폴리오 핵심 지표">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
    ) });
  }

  // 프로젝트는 카드 하나가 페이지 배치의 단위다. 통째로 묶으면 앞 페이지에
  // 빈 공간이 크게 남는다. 인쇄에서도 카드 단위로 나뉘므로 같은 단위를 쓴다.
  blocks.push({ key: "projects-label", node: (
      <div className="result-block" id="portfolio-work">
        {/* 보기에는 섹션 제목인데 <p>라, 제목만으로 이동하는 사용자에게는
            이 문서에 프로젝트 절이 있다는 사실이 없는 것과 같았다. 클래스가
            모양을 전부 지정하므로 태그만 바꾼다. */}
        <h2 className="result-section-label">PROJECTS</h2>
      </div>
  ) });

  content.projects.forEach((project) => {
    blocks.push({ key: `project-${project.id}`, kind: "project", node: (
      <div className="result-block">
            <article className="result-project-card">
              <div className="result-project-title-row">
                <div>
                  <p>{project.role}</p>
                  <h3>{project.title}</h3>
                </div>
                <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
                  Repository ↗
                </a>
              </div>

              <p className="result-project-description">{project.description}</p>

              {project.techStack.length > 0 && (
                <div className="result-tech-list">
                  {project.techStack.map((tech) => <span key={tech}>{tech}</span>)}
                </div>
              )}

              {project.highlights.length > 0 && (
                <ul className="result-highlight-list">
                  {project.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              )}

              {storyColumns(project).length > 0 && (
                <div className="result-story-list">
                  {storyColumns(project).map((column) => (
                    <div key={column.label}>
                      <span>{column.label}</span>
                      <ul>
                        {column.items.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
      </div>
    ) });
  });

  blocks.push({ key: "skills", node: (
      <section
        className="result-expertise-section"
        id="portfolio-expertise"
      >
        <h2 className="result-section-label">SKILLS</h2>

        {/*
          예전에는 저장소 설명문(summary)이 SKILLS 맨 위에 라벨 없이 놓여
          있었다. 역량을 말하는 절에서 저장소를 서술하니 무엇을 읽고 있는지
          알 수 없었다. 아래 패턴 칩과 한 묶음으로 내린다 — 둘 다 저장소에서
          읽은 것이고, 묶으면 이 문장이 칩을 소개하는 역할을 얻는다.

          순서도 바꾼다. 본인이 밝힌 역량이 먼저, 측정값이 다음, 서술이 끝.
        */}
        <div className="result-expertise-content">
          {content.skills.length > 0 && (
            <div className="result-skill-groups">
              {content.skills.map((group) => (
                <div className="result-skill-group" key={group.category}>
                  <h3>{group.category}</h3>
                  <p>{group.skills.join(" · ")}</p>
                </div>
              ))}
            </div>
          )}

          {content.gitAnalysis.languages.length > 0 && (
            /*
              이 막대가 무엇인지 밝힌다. 이력서의 스킬 막대가 비판받는 이유는
              "70%"가 무엇을 기준으로 한 값인지 알 수 없기 때문인데, 이건
              자기평가가 아니라 저장소 코드 비율이다. 그 사실이 보여야 같은
              오해를 사지 않는다.
            */
            <div className="result-language-list">
              <p className="result-language-caption">저장소 코드 비율</p>
              {content.gitAnalysis.languages.map((language) => (
                <div className="result-language-row" key={language.name}>
                  <div className="result-language-label">
                    <span>{language.name}</span>
                    <strong>{language.percentage}%</strong>
                  </div>
                  {/* 색은 보조 수단이다 — 언어 이름과 퍼센트가 이미 글자로
                      옆에 있으므로, 흑백으로 인쇄돼도 잃는 정보가 없다.

                      색을 background로 직접 박지 않고 변수로 넘긴다. 인라인
                      background는 !important 없이는 어떤 규칙도 못 이겨서,
                      인쇄에서 조정할 길이 막힌다. 값은 데이터가 정하고
                      쓰는 방법은 CSS가 정한다. */}
                  <div className="result-language-track">
                    <span
                      className="result-language-fill"
                      style={{
                        width: `${language.percentage}%`,
                        ...accent(language.name),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {(content.gitAnalysis.summary || content.gitAnalysis.notablePatterns.length > 0) && (
            <div className="result-pattern-list">
              <p className="result-pattern-caption">저장소에서 읽은 것</p>
              {content.gitAnalysis.summary && (
                <p className="result-expertise-summary">{content.gitAnalysis.summary}</p>
              )}
              {content.gitAnalysis.notablePatterns.map((pattern) => (
                <span key={pattern}>{pattern}</span>
              ))}
            </div>
          )}
        </div>
      </section>
  ) });

  blocks.push({ key: "footer", node: (
      <footer className="result-portfolio-footer">
        <p>© 2026 {content.profile.displayName}</p>
        <span>{content.profile.targetRole} PORTFOLIO</span>
        <a href="#portfolio-top">Back to top ↑</a>
      </footer>
  ) });

  if (paginated) {
    return <PaginatedPortfolio blocks={blocks} onPageCount={onPageCount} />;
  }

  return (
    <article className="portfolio-preview result-portfolio-preview">
      {blocks.map((block) => <Fragment key={block.key}>{block.node}</Fragment>)}
    </article>
  );
}
