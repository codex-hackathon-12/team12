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
    const initials =
      content.profile.displayName.replace(/\s/gu, "").slice(0, 2).toUpperCase() ||
      "PF";
    const topSkills = Array.from(
      new Set(content.skills.flatMap((group) => group.skills)),
    ).slice(0, 4);
    const contactHref = content.contact.email
      ? `mailto:${content.contact.email}`
      : content.contact.githubUrl;

    return (
      <article className="portfolio-preview result-portfolio-preview">
        <nav className="result-portfolio-nav" aria-label="포트폴리오 목차">
          <a className="result-portfolio-brand" href="#portfolio-top">
            <span>{initials}</span>
            <strong>{content.profile.displayName}</strong>
          </a>
          <div>
            <a href="#portfolio-about">About</a>
            <a href="#portfolio-work">Work</a>
            <a href="#portfolio-expertise">Expertise</a>
          </div>
          <a className="result-nav-contact" href={contactHref}>
            Contact ↗
          </a>
        </nav>

        <header className="result-portfolio-hero" id="portfolio-top">
          <div className="result-hero-copy">
            <p className="result-hero-kicker">
              <span /> OPEN TO OPPORTUNITIES · 2026
            </p>
            <h1>
              <span>안녕하세요, {content.profile.displayName}입니다.</span>
              {content.profile.headline}
            </h1>
            <p className="result-hero-description">{content.introduction}</p>
            <div className="result-hero-actions">
              <a href="#portfolio-work">프로젝트 보기 ↓</a>
              <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
                GitHub ↗
              </a>
            </div>
          </div>

          <aside className="result-profile-panel" aria-label="프로필 요약">
            <div className="result-profile-panel-top">
              <span>PROFILE / 01</span>
              <span>FOLIO.AI</span>
            </div>
            <div className="result-profile-monogram" aria-hidden="true">
              {initials}
            </div>
            <dl className="result-profile-details">
              <div>
                <dt>Role</dt>
                <dd>{content.profile.targetRole}</dd>
              </div>
              <div>
                <dt>Based in</dt>
                <dd>{content.contact.location ?? "Seoul · Remote"}</dd>
              </div>
              <div>
                <dt>Core</dt>
                <dd>{topSkills.join(" · ")}</dd>
              </div>
            </dl>
          </aside>
        </header>

        <dl className="result-metric-strip" aria-label="포트폴리오 핵심 지표">
          <div>
            <dt>Selected projects</dt>
            <dd>{String(content.projects.length).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Core skills</dt>
            <dd>{String(skillCount).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Primary language</dt>
            <dd>{content.gitAnalysis.primaryLanguage ?? "—"}</dd>
          </div>
          <div>
            <dt>GitHub signal</dt>
            <dd>{content.gitAnalysis.starCount}★ · {content.gitAnalysis.forkCount}⑂</dd>
          </div>
        </dl>

        <section
          className="result-portfolio-section result-about-section"
          id="portfolio-about"
        >
          <div className="result-section-heading-block">
            <span>01 / ABOUT</span>
            <h2>기술보다 먼저,<br />문제를 이해합니다.</h2>
          </div>
          <div className="result-about-content">
            <p>{content.introduction}</p>
            <div className="result-about-details">
              <div>
                <span>현재 목표</span>
                <strong>{content.profile.targetRole}</strong>
              </div>
              <div>
                <span>주요 관심사</span>
                <strong>{topSkills.slice(0, 3).join(", ")}</strong>
              </div>
              <div>
                <span>연락하기</span>
                <a href={contactHref}>
                  {content.contact.email ?? "GitHub profile"} ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          className="result-portfolio-section result-project-section"
          id="portfolio-work"
        >
          <div className="result-section-heading-block result-project-heading">
            <span>02 / SELECTED WORK</span>
            <h2>결과 뒤에 있는<br />판단을 보여줍니다.</h2>
            <p>문제를 정의하고, 기술을 선택하고, 결과를 만든 과정을 프로젝트별로 정리했습니다.</p>
          </div>
          <div className="result-project-list">
            {content.projects.map((project, index) => (
              <article className="result-project-card" key={project.id}>
                <div className="result-project-header">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
                    View repository ↗
                  </a>
                </div>
                <div className="result-project-title-row">
                  <div>
                    <p>{project.role}</p>
                    <h3>{project.title}</h3>
                  </div>
                  <div className="result-tech-list">
                    {project.techStack.map((tech) => <span key={tech}>{tech}</span>)}
                  </div>
                </div>
                <p className="result-project-description">{project.description}</p>

                {project.highlights.length > 0 && (
                  <div className="result-highlight-list">
                    {project.highlights.map((highlight) => (
                      <p key={highlight}><span>✓</span>{highlight}</p>
                    ))}
                  </div>
                )}

                <div className="result-story-list">
                  <div>
                    <span>01 · Challenge</span>
                    {project.challenges.map((challenge) => (
                      <p key={challenge}>{challenge}</p>
                    ))}
                  </div>
                  <div>
                    <span>02 · Approach</span>
                    {project.solutions.map((solution) => (
                      <p key={solution}>{solution}</p>
                    ))}
                  </div>
                  <div>
                    <span>03 · Impact</span>
                    {project.impact.map((impact) => (
                      <p key={impact}>{impact}</p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="result-expertise-section"
          id="portfolio-expertise"
        >
          <div className="result-section-heading-block result-expertise-heading">
            <span>03 / EXPERTISE</span>
            <h2>도구를 넘어<br />완성도를 만듭니다.</h2>
            <p>{content.gitAnalysis.summary}</p>
          </div>
          <div className="result-expertise-content">
            <div className="result-skill-groups">
              {content.skills.map((group, index) => (
                <div className="result-skill-group" key={group.category}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{group.category}</h3>
                    <p>{group.skills.join(" · ")}</p>
                  </div>
                </div>
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

            <div className="result-pattern-list">
              {content.gitAnalysis.notablePatterns.map((pattern) => (
                <span key={pattern}>↳ {pattern}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="result-contact-section">
          <p>LET&apos;S BUILD SOMETHING MEANINGFUL</p>
          <h2>좋은 코드는,<br />설명될 때 더 큰 기회가 됩니다.</h2>
          <div>
            <a href={contactHref}>함께 이야기하기 ↗</a>
            <a href={content.contact.githubUrl} target="_blank" rel="noreferrer">
              GitHub에서 더 보기 ↗
            </a>
          </div>
        </section>

        <footer className="result-portfolio-footer">
          <p>© 2026 {content.profile.displayName}</p>
          <span>{content.profile.targetRole} PORTFOLIO</span>
          <a href="#portfolio-top">Back to top ↑</a>
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
