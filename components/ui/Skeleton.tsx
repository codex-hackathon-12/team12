/**
 * 스켈레톤 — 내용이 올 자리를 그 모양대로 비워 보여준다.
 *
 * 처음에는 범용 행·카드 모양 한 벌로 때웠다. 그러자 "생긴 게 이상하다"는
 * 말을 들었다 — 자리 표시가 진짜와 다르게 생기면 오히려 화면이 두 번
 * 바뀌는 것처럼 보인다.
 *
 * 그래서 각 화면의 **실제 컨테이너 클래스를 그대로 빌려 쓴다.** 행 높이,
 * 칸 나눔, 카드 최소 높이, 간격이 전부 진짜 CSS에서 오므로 진짜가 왔을 때
 * 아무것도 움직이지 않는다. 진짜 컴포넌트의 치수를 바꾸면 자리 표시도
 * 따라온다 — 숫자를 베껴 적으면 그때부터 어긋나기 시작한다.
 *
 * 조각(aria-hidden)은 낭독기에서 빠지고, 화면 묶음이 role="status"와
 * 라벨로 "불러오는 중"을 말한다 — 스피너 시절의 접근성 계약 그대로다.
 */

/** 한 조각. 폭·높이·둥글기만 다르고 색과 맥동은 CSS가 정한다. */
export function Skeleton({
  w,
  h = 14,
  r = 6,
}: {
  w: number | string;
  h?: number | string;
  r?: number;
}) {
  return <span aria-hidden="true" className="skeleton" style={{ width: w, height: h, borderRadius: r }} />;
}

/**
 * 문단 자리. 줄 폭을 고정 패턴으로 어긋나게 해 글처럼 보이게 한다 —
 * 난수를 쓰면 서버와 클라이언트 렌더가 어긋난다.
 */
const TEXT_WIDTHS = ["92%", "78%", "85%", "64%"] as const;

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span className="skeleton-text">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} w={TEXT_WIDTHS[index % TEXT_WIDTHS.length]} />
      ))}
    </span>
  );
}

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** 저장소 목록 자리. 행 높이 46px·칸 나눔은 `.repository-row-label`이 정한다. */
export function RepositoryRowsSkeleton({ label, rows = 7 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label}>
      {/* 목록 위 "n개 표시 · 전체 n개" 줄의 자리. 없으면 진짜가 오는 순간
          목록 전체가 그 줄 높이만큼 내려앉는다. */}
      <div className="skeleton-count-line" aria-hidden="true"><Skeleton w={150} h={12} /></div>
      <ul className="repository-rows" aria-hidden="true">
      {range(rows).map((index) => (
        <li className="repository-row" key={index}>
          <Skeleton w={17} h={17} r={4} />
          <span className="repository-row-label" aria-hidden="true">
            <span><Skeleton w={index % 2 ? 120 : 160} h={15} /></span>
            <span><Skeleton w={index % 2 ? 300 : 230} h={12} /></span>
            <span><Skeleton w={78} h={10} /></span>
            <span><Skeleton w={54} h={10} /></span>
          </span>
        </li>
      ))}
      </ul>
    </div>
  );
}

/** 내 포트폴리오 카드 자리. 격자와 카드 여백은 실제 클래스가 정한다. */
export function PortfolioCardsSkeleton({ label, cards = 3 }: { label: string; cards?: number }) {
  return (
    <div className="portfolio-list-grid" role="status" aria-label={label}>
      {range(cards).map((index) => (
        <article className="portfolio-list-card skeleton-stack" key={index} aria-hidden="true">
          <div className="skeleton-between">
            <Skeleton w={110} h={11} />
            <Skeleton w={64} h={11} />
          </div>
          <Skeleton w={index % 2 ? "58%" : "74%"} h={26} />
          <Skeleton w="42%" h={13} />
          <div className="tag-row">
            <Skeleton w={64} h={26} r={4} />
            <Skeleton w={48} h={26} r={4} />
            <Skeleton w={72} h={26} r={4} />
          </div>
          <div className="skeleton-between skeleton-gap">
            <Skeleton w={46} h={14} />
            <Skeleton w={30} h={14} />
          </div>
        </article>
      ))}
    </div>
  );
}

/** 갤러리 카드 자리. 16:10 미리보기 면적은 `.gallery-visual`이 정한다. */
export function GalleryCardsSkeleton({ label, cards = 4 }: { label: string; cards?: number }) {
  return (
    <div className="gallery-grid" role="status" aria-label={label}>
      {range(cards).map((index) => (
        <div className="gallery-card" key={index} aria-hidden="true">
          <div className="gallery-visual skeleton-fill" />
          <div className="gallery-card-copy">
            <Skeleton w={92} h={10} />
            <div className="skeleton-gap"><Skeleton w={index % 2 ? "55%" : "70%"} h={34} /></div>
            <div className="skeleton-gap"><SkeletonText lines={2} /></div>
            {/* 화살표 단추 줄의 높이. */}
            <div className="skeleton-gap"><Skeleton w={37} h={16} r={999} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 크레딧 화면 자리. 카드 최소 높이 350px·가격 줄 위치는 `.product-card`가 정한다. */
export function BillingPageSkeleton({ label }: { label: string }) {
  return (
    <div className="page-container billing-page" role="status" aria-label={label}>
      <section className="billing-products" aria-hidden="true">
        <div className="section-title-row compact-title">
          <div>
            <Skeleton w={110} h={11} />
            <div className="skeleton-gap"><Skeleton w={240} h={28} /></div>
          </div>
        </div>
        {/* 잔액 카드의 자리. 라임 카드가 큰 면적이라 빼면 상품 격자가 그만큼
            튀어 오른 채 시작한다. */}
        <div className="credit-balance-card skeleton-fill">
          <Skeleton w={90} h={13} />
          <div className="skeleton-gap"><Skeleton w={130} h={45} /></div>
          <Skeleton w={160} h={12} />
          <div className="skeleton-gap"><Skeleton w={210} h={14} /></div>
        </div>
        <div className="product-grid">
          {range(3).map((index) => (
            <div className="product-card" key={index}>
              <span className="product-radio" />
              <div>
                <Skeleton w={120} h={44} r={8} />
                <Skeleton w={80} h={10} />
                <SkeletonText lines={2} />
              </div>
              <div className="product-price"><Skeleton w={90} h={16} /></div>
              <Skeleton w="100%" h={62} r={10} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** 대시보드 자리. 좌우 나눔은 `.split-section`(1.25fr/0.75fr)이 정한다. */
export function DashboardPageSkeleton({ label }: { label: string }) {
  return (
    <div className="page-container dashboard-page" role="status" aria-label={label}>
      <section className="dashboard-section split-section" aria-hidden="true">
        <div className="skeleton-stack">
          <Skeleton w={100} h={11} />
          <Skeleton w={200} h={26} />
          {range(3).map((index) => (
            <div className="skeleton-line-row" key={index}>
              <Skeleton w={26} h={12} />
              <span>
                <Skeleton w={index % 2 ? "44%" : "58%"} h={15} />
                <Skeleton w="30%" h={11} />
              </span>
              <Skeleton w={56} h={11} />
            </div>
          ))}
        </div>
        <div className="skeleton-stack">
          <Skeleton w={110} h={11} />
          <Skeleton w={160} h={26} />
          {range(2).map((index) => (
            <div className="skeleton-line-row" key={index}>
              <span>
                <Skeleton w="70%" h={14} />
                <Skeleton w="36%" h={11} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** 설정 자리. 아바타 56px 원과 배치는 `.connection-card`가 정한다. */
export function SettingsPageSkeleton({ label }: { label: string }) {
  return (
    <div className="page-container settings-page" role="status" aria-label={label}>
      <section className="settings-section" aria-hidden="true">
        <div className="section-title-row compact-title">
          <div>
            <Skeleton w={150} h={11} />
            <div className="skeleton-gap"><Skeleton w={200} h={28} /></div>
          </div>
        </div>
        <div className="connection-card">
          <Skeleton w={56} h={56} r={999} />
          <span className="skeleton-stack-tight">
            <Skeleton w={140} h={16} />
            <Skeleton w={180} h={12} />
          </span>
        </div>
      </section>
    </div>
  );
}

/** 프롬프트 화면 자리. 330px/1fr 나눔은 `.prompt-layout`이 정한다. */
export function PromptPageSkeleton({ label }: { label: string }) {
  return (
    <div className="page-container" role="status" aria-label={label}>
      <div className="prompt-layout" aria-hidden="true">
        <aside className="skeleton-stack">
          <Skeleton w={170} h={11} />
          {range(3).map((index) => (
            <div className="skeleton-line-row" key={index}>
              <span>
                <Skeleton w={index % 2 ? "52%" : "66%"} h={14} />
                <Skeleton w="80%" h={11} />
              </span>
            </div>
          ))}
        </aside>
        <div className="skeleton-stack">
          <Skeleton w={220} h={28} />
          <div className="skeleton-between">
            <Skeleton w="48%" h={54} r={8} />
            <Skeleton w="48%" h={54} r={8} />
          </div>
          <div className="skeleton-chip-row">
            {range(6).map((index) => (
              <Skeleton key={index} w={92 + (index % 3) * 26} h={34} r={999} />
            ))}
          </div>
          <Skeleton w="100%" h={180} r={10} />
        </div>
      </div>
    </div>
  );
}

/**
 * 문서 화면 자리. 도구줄은 `.document-toolbar`, 회색 캔버스는
 * `.portfolio-canvas-wrap`, 종이는 A4 비율(210:297)에 화면 종이와 같은
 * 794px 폭·색이다.
 */
export function DocumentPageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      {/* 문서 위 결과 툴바(완료 배지 + 행동 버튼들)의 자리. 없으면 진짜가
          오는 순간 문서가 그 높이만큼 내려앉는다. */}
      <div className="page-container result-toolbar" aria-hidden="true">
        <div className="skeleton-line-flex">
          <Skeleton w={42} h={42} r={999} />
          <span className="skeleton-stack-tight">
            <Skeleton w={110} h={14} />
            <Skeleton w={220} h={20} />
          </span>
        </div>
        <div className="skeleton-line-flex">
          <Skeleton w={124} h={48} r={10} />
          <Skeleton w={124} h={48} r={10} />
          <Skeleton w={72} h={48} r={10} />
        </div>
      </div>
      <div className="document-toolbar" aria-hidden="true">
        {/* 보기 전환 스위치는 이름+설명 두 줄이라 71px이다. */}
        <Skeleton w={214} h={71} r={0} />
        <Skeleton w={150} h={48} r={10} />
      </div>
      <div className="portfolio-canvas-wrap" aria-hidden="true">
        <div className="skeleton-paper">
          <Skeleton w={64} h={64} r={999} />
          <Skeleton w="42%" h={28} />
          <SkeletonText lines={2} />
          <div className="skeleton-gap"><Skeleton w={110} h={12} /></div>
          <Skeleton w="55%" h={20} />
          <SkeletonText lines={4} />
          <div className="skeleton-chip-row">
            <Skeleton w={78} h={22} r={4} />
            <Skeleton w={56} h={22} r={4} />
            <Skeleton w={66} h={22} r={4} />
          </div>
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}
