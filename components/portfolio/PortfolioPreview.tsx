import type { ReactNode } from "react";
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

/**
 * 규격 이전 결과의 서술 항목.
 *
 * 새 결과는 `keyDecision` 하나로 쓴다. 이 경로를 남겨두는 것은 이미 저장된
 * 포트폴리오가 이 값을 들고 있어서다 — 지우면 그 사람들의 문서에서 문장이
 * 사라진다. 근거가 없으면 빈 배열이 오므로 내용이 있는 항목만 열로 만든다.
 */
function storyColumns(project: PortfolioProjectDto): Array<{ label: string; items: string[] }> {
  return [
    { label: "Challenge", items: project.challenges },
    { label: "Approach", items: project.solutions },
    { label: "Impact", items: project.impact },
  ].filter((column) => column.items.length > 0);
}

/**
 * 프로젝트를 읽기 전에 필요한 맥락 한 줄.
 *
 * 면접관이 가장 먼저 찾는 것이 "무슨 역할로, 몇 명이서, 언제"다. 없는 값은
 * 칸을 만들지 않는다 — 빈칸을 남기느니 그 사실을 말하지 않는 편이 낫다.
 */
function metaLine(project: PortfolioProjectDto): string {
  return [project.role, project.context.scale, project.context.period]
    .filter(Boolean)
    .join(" · ");
}

export function PortfolioPreview({
  content,
  paginated = false,
  onPageCount,
  renderProjectSlot,
}: {
  content: PortfolioContentDto;
  /** A4 낱장으로 나눠 인쇄 미리보기처럼 보여준다. */
  paginated?: boolean;
  /** 나눠본 장수. 인쇄 전 분량 안내에 쓴다. */
  onPageCount?: (count: number) => void;
  /**
   * 프로젝트 카드 안에 끼워 넣을 화면 전용 요소.
   *
   * 결과 화면이 되묻기 카드를 여기 넣는다. 공개 페이지와 갤러리는 넘기지
   * 않으므로 아무것도 그려지지 않는다 — 이 방향이 아니면 남에게 보내는
   * 링크에 질문이 새어 나간다. 문서는 무엇이 들어오는지 알 필요가 없다.
   */
  renderProjectSlot?: (project: PortfolioProjectDto) => ReactNode;
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
                  <p>{metaLine(project)}</p>
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

              {/*
                프로젝트의 본문. 짧은 불릿을 열 개 나열하는 대신 결정 하나를
                문제 → 선택과 근거 → 결과로 이어 쓴다. 면접관이 읽는 것은
                나열이 아니라 결정이고, 후속 질문을 던질 지점이 여기 생긴다.
              */}
              {project.keyDecision.headline && (
                <div className="result-decision">
                  <h4>
                    <span>핵심 결정</span>
                    {project.keyDecision.headline}
                  </h4>
                  {project.keyDecision.problem && <p>{project.keyDecision.problem}</p>}
                  {project.keyDecision.approach && <p>{project.keyDecision.approach}</p>}
                  {project.keyDecision.outcome && (
                    <p className="result-decision-outcome">{project.keyDecision.outcome}</p>
                  )}
                </div>
              )}

              {renderProjectSlot?.(project)}

              {project.highlights.length > 0 && (
                <>
                  {/* 결정이 본문이고 이건 나머지다. 표지가 없으면 둘이 같은
                      무게로 읽혀 결정이 묻힌다. */}
                  {project.keyDecision.headline && (
                    <p className="result-highlight-caption">그 밖에</p>
                  )}
                  <ul className="result-highlight-list">
                    {project.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </>
              )}

              {/* 규격 이전 결과만 이 경로로 온다. 결정이 있으면 그것이 본문이므로
                  같은 내용을 두 모양으로 두 번 보여주지 않는다. */}
              {!project.keyDecision.headline && storyColumns(project).length > 0 && (
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

  /* 블록마다 <div>로 감싼다. 높이를 재는 사본(PaginatedPortfolio)이 같은
     래퍼를 쓰기 때문이다. 한쪽만 감싸면 마진 상쇄가 달라져 잰 높이와 실제
     높이가 어긋나고, 그 차이가 그대로 미리보기와 인쇄의 차이가 된다.
     인쇄는 이 경로를 쓴다 — 종이 폭에서는 낱장 보기가 열리지 않는다. */
  return (
    <article className="portfolio-preview result-portfolio-preview">
      {blocks.map((block) => <div key={block.key}>{block.node}</div>)}
    </article>
  );
}
