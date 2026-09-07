/**
 * 스켈레톤 — 내용이 올 자리를 그 모양대로 비워 보여준다.
 *
 * 스피너는 "기다리세요"만 말하고, 어디에 무엇이 올지는 말하지 않는다. 자리
 * 모양을 미리 그리면 화면이 덜컥 바뀌지 않고, 기다리는 동안 무엇을 보게 될지
 * 감이 잡힌다.
 *
 * 조각(aria-hidden)은 낭독기에서 빠지고, 페이지 묶음이 role="status"와
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

/* 라벨이 있으면 스스로 상태를 알리고, 없으면(더 큰 자리에 담겨) 장식으로
   빠진다. 빈 라벨의 role="status"는 무엇을 기다리는지 말하지 않는 알림이다. */
const announce = (label?: string) =>
  label ? ({ role: "status", "aria-label": label } as const) : ({ "aria-hidden": true } as const);

/**
 * 행 목록 자리. 화면이 제목·도구줄을 이미 그리고 있으면 이것만 그 아래에
 * 넣는다 — 제목까지 다시 그리면 진짜 제목과 겹쳐 두 벌이 된다.
 */
export function SkeletonRows({ label, rows = 6 }: { label?: string; rows?: number }) {
  return (
    <div className="skeleton-rows" {...announce(label)}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <Skeleton w={18} h={18} r={5} />
          <span>
            <Skeleton w={index % 2 ? "34%" : "46%"} />
            <Skeleton w={index % 2 ? "68%" : "55%"} h={11} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** 카드 격자 자리. 행 목록과 같은 이유로 맨몸이다. */
export function SkeletonCards({ label, cards = 3 }: { label?: string; cards?: number }) {
  return (
    <div className="skeleton-cards" {...announce(label)}>
      {Array.from({ length: cards }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <Skeleton w="52%" h={18} />
          <SkeletonText lines={3} />
          <Skeleton w={110} h={30} r={999} />
        </div>
      ))}
    </div>
  );
}

/** 목록 화면 전체 자리 — 제목 줄까지. 화면 전체를 대신할 때만 쓴다. */
export function ListPageSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div className="page-container skeleton-page" role="status" aria-label={label}>
      <Skeleton w={96} h={12} />
      <Skeleton w={220} h={26} />
      <SkeletonRows rows={rows} />
    </div>
  );
}

/** 카드 화면 전체 자리 — 제목 줄까지. */
export function CardsPageSkeleton({ label, cards = 3 }: { label: string; cards?: number }) {
  return (
    <div className="page-container skeleton-page" role="status" aria-label={label}>
      <Skeleton w={96} h={12} />
      <Skeleton w={220} h={26} />
      <SkeletonCards cards={cards} />
    </div>
  );
}

/** 문서 화면 자리 — 회색 캔버스 위 종이. 결과·갤러리 상세가 쓴다. */
export function DocumentPageSkeleton({ label }: { label: string }) {
  return (
    <div className="skeleton-page" role="status" aria-label={label}>
      <div className="page-container skeleton-doc-toolbar">
        <Skeleton w={180} h={40} r={8} />
        <Skeleton w={140} h={40} r={8} />
      </div>
      <div className="skeleton-canvas">
        <div className="skeleton-paper">
          <Skeleton w={64} h={64} r={999} />
          <Skeleton w="42%" h={24} />
          <SkeletonText lines={2} />
          <Skeleton w="30%" h={12} />
          <SkeletonText lines={4} />
        </div>
      </div>
    </div>
  );
}
