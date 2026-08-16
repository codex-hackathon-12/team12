import type { PortfolioContentDto } from "@/contracts/api-contract";

export function PortfolioPreview({
  content,
  compact = false,
  variant = "default",
}: {
  content: PortfolioContentDto;
  compact?: boolean;
  variant?: "default" | "result";
}) {
  if (variant === "result") {
    const skillCount = content.skills.reduce(
      (total, group) => total + group.skills.length,
      0,
    );

    return (
      <article className="portfolio-preview result-portfolio-preview">
        <header className="result-portfolio-hero">
          <div className="result-portfolio-meta">
            <span>PORTFOLIO · 2026</span>
            <span>{content.profile.targetRole}</span>
          </div>
          <div className="result-portfolio-intro">
            <div>
              <h1>{content.profile.displayName}</h1>
              <p>{content.profile.headline}</p>
            </div>
            <div className="result-contact-card">
              <span>CONTACT</span>
              <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
                GitHub ↗
              </a>
              {content.contact.email && (
                <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
              )}
            </div>
          </div>
        </header>

        <section className="result-overview-section">
          <div className="result-section-label">
            <span>01</span>
            <strong>소개</strong>
          </div>
          <div>
            <p className="result-introduction">{content.introduction}</p>
            <dl className="result-summary-grid">
              <div><dt>프로젝트</dt><dd>{content.projects.length}</dd></div>
              <div><dt>핵심 기술</dt><dd>{skillCount}</dd></div>
              <div><dt>주요 언어</dt><dd>{content.gitAnalysis.primaryLanguage}</dd></div>
            </dl>
          </div>
        </section>

        <section className="result-content-section">
          <div className="result-section-label">
            <span>02</span>
            <strong>역량</strong>
          </div>
          <div>
            <div className="result-section-heading">
              <p>문제를 해결하기 위해 선택한 기술과 협업 방식입니다.</p>
            </div>
            <div className="result-skill-groups">
              {content.skills.map((group) => (
                <div className="result-skill-group" key={group.category}>
                  <h2>{group.category}</h2>
                  <div>
                    {group.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="result-content-section result-project-section">
          <div className="result-section-label">
            <span>03</span>
            <strong>프로젝트</strong>
          </div>
          <div className="result-project-list">
            {content.projects.map((project, index) => (
              <article className="result-project-card" key={project.id}>
                <div className="result-project-header">
                  <div>
                    <span>PROJECT {String(index + 1).padStart(2, "0")}</span>
                    <h2>{project.title}</h2>
                    <p>{project.role}</p>
                  </div>
                  <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
                    저장소 보기 ↗
                  </a>
                </div>
                <p className="result-project-description">{project.description}</p>
                <div className="result-story-list">
                  <div>
                    <span>문제</span>
                    <p>{project.challenges[0]}</p>
                  </div>
                  <div>
                    <span>접근</span>
                    <p>{project.solutions[0]}</p>
                  </div>
                  <div>
                    <span>결과</span>
                    <p>{project.impact[0]}</p>
                  </div>
                </div>
                <div className="result-tech-list">
                  {project.techStack.map((tech) => <span key={tech}>{tech}</span>)}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="result-content-section result-analysis-section">
          <div className="result-section-label">
            <span>04</span>
            <strong>Git 분석</strong>
          </div>
          <div className="result-analysis-content">
            <h2>{content.gitAnalysis.summary}</h2>
            <div className="result-pattern-list">
              {content.gitAnalysis.notablePatterns.map((pattern) => (
                <span key={pattern}>✓ {pattern}</span>
              ))}
            </div>
            <div className="result-language-list" aria-label="언어 사용 비율">
              {content.gitAnalysis.languages.map((language) => (
                <div key={language.name}>
                  <div><span>{language.name}</span><strong>{language.percentage}%</strong></div>
                  <div><span style={{ width: `${language.percentage}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="result-portfolio-footer">
          <p>{content.profile.displayName} · {content.profile.targetRole}</p>
          <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
            GitHub profile ↗
          </a>
        </footer>
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
              <div className="project-story-grid">
                <div>
                  <span>Challenge</span>
                  <p>{project.challenges[0]}</p>
                </div>
                <div>
                  <span>Approach</span>
                  <p>{project.solutions[0]}</p>
                </div>
                <div>
                  <span>Impact</span>
                  <p>{project.impact[0]}</p>
                </div>
              </div>
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
            <a href={`mailto:${content.contact.email ?? ""}`}>
              {content.contact.email ?? "GitHub에서 연락하기"}
            </a>
          </div>
          <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
            GitHub profile ↗
          </a>
        </footer>
      )}
    </article>
  );
}
