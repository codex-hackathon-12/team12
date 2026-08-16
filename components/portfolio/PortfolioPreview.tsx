import type { PortfolioContentDto } from "@/contracts/api-contract";

export function PortfolioPreview({
  content,
  compact = false,
}: {
  content: PortfolioContentDto;
  compact?: boolean;
}) {
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
