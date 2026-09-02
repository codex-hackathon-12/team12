import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { PaginatedPortfolio } from "@/components/portfolio/PaginatedPortfolio";
import type { PortfolioContentDto, PortfolioProjectDto } from "@/contracts/api-contract";

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
  compact = false,
  variant = "default",
  paginated = false,
  onPageCount,
}: {
  content: PortfolioContentDto;
  compact?: boolean;
  variant?: "default" | "result";
  /** A4 낱장으로 나눠 인쇄 미리보기처럼 보여준다. */
  paginated?: boolean;
  /** 나눠본 장수. 인쇄 전 분량 안내에 쓴다. */
  onPageCount?: (count: number) => void;
}) {
  if (variant === "result") {
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
              <h1>{content.profile.displayName}</h1>
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
          <p className="result-section-label">PROJECTS</p>
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
          <p className="result-section-label">SKILLS</p>

          <div className="result-expertise-content">
            {content.gitAnalysis.summary && (
              <p className="result-expertise-summary">{content.gitAnalysis.summary}</p>
            )}

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
              <div className="result-language-list" aria-label="언어 사용 비율">
                {content.gitAnalysis.languages.map((language) => (
                  <div key={language.name}>
                    <div><span>{language.name}</span><strong>{language.percentage}%</strong></div>
                    <div><span style={{ width: `${language.percentage}%` }} /></div>
                  </div>
                ))}
              </div>
            )}

            {content.gitAnalysis.notablePatterns.length > 0 && (
              <div className="result-pattern-list">
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

  return (
    <article className={compact ? "portfolio-preview compact" : "portfolio-preview"}>
      <header className="portfolio-hero">
        <div>
          <p className="portfolio-kicker">PORTFOLIO · 2026</p>
          <h1>{content.profile.displayName}</h1>
          <p className="portfolio-headline">{content.profile.headline}</p>
        </div>
        <div className="portfolio-role-block">
          <span>Target role</span>
          <strong>{content.profile.targetRole}</strong>
        </div>
      </header>

      <section className="portfolio-intro">
        <p className="section-index">01 / ABOUT</p>
        <p>{content.introduction}</p>
      </section>

      <section className="portfolio-section">
        <div className="portfolio-section-heading">
          <p className="section-index">02 / CAPABILITIES</p>
          <h2>기술은 문제를 풀기 위한 선택입니다.</h2>
        </div>
        <div className="skill-groups">
          {content.skills.map((group) => (
            <div className="skill-group" key={group.category}>
              <span>{group.category}</span>
              <p>{group.skills.join(" · ")}</p>
            </div>
          ))}
        </div>
      </section>

      {!compact && (
        <section className="portfolio-section project-section">
          <div className="portfolio-section-heading">
            <p className="section-index">03 / SELECTED WORK</p>
            <h2>결과보다 판단의 과정을 보여줍니다.</h2>
          </div>
          {content.projects.map((project) => (
            <article className="portfolio-project" key={project.id}>
              <div className="project-title-row">
                <div>
                  <p>{project.role}</p>
                  <h3>{project.title}</h3>
                </div>
                <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
                  GitHub ↗
                </a>
              </div>
              <p className="project-description">{project.description}</p>
              {/* 근거가 없으면 빈 배열이 온다. result variant와 같은 규칙을 쓴다. */}
              {storyColumns(project).length > 0 && (
                <div className="project-story-grid">
                  {storyColumns(project).map((column) => (
                    <div key={column.label}>
                      <span>{column.label}</span>
                      <p>{column.items[0]}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="tag-row">
                {project.techStack.map((tech) => (
                  <span className="plain-tag" key={tech}>
                    {tech}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="portfolio-section git-analysis-section">
        <div>
          <p className="section-index">{compact ? "03" : "04"} / GIT SIGNALS</p>
          <h2>{content.gitAnalysis.summary}</h2>
          <div className="pattern-list">
            {content.gitAnalysis.notablePatterns.map((pattern) => (
              <span key={pattern}>↳ {pattern}</span>
            ))}
          </div>
        </div>
        <div className="language-chart" aria-label="언어 사용 비율">
          {content.gitAnalysis.languages.map((language) => (
            <div className="language-row" key={language.name}>
              <div>
                <span>{language.name}</span>
                <strong>{language.percentage}%</strong>
              </div>
              <div className="language-track">
                <span style={{ width: `${language.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {!compact && (
        <footer className="portfolio-footer">
          <div>
            <span>CONTACT</span>
            {/* 이메일이 없을 때 빈 mailto:로 두면 라벨은 GitHub를 가리키는데
                링크는 아무 데도 가지 않는다. 라벨과 대상을 맞춘다. */}
            {content.contact.email ? (
              <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
            ) : (
              <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
                GitHub에서 연락하기
              </a>
            )}
          </div>
          <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
            GitHub profile ↗
          </a>
        </footer>
      )}
    </article>
  );
}
