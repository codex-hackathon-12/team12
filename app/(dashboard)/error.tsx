"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * 렌더 중 예외가 났을 때의 마지막 안전망.
 *
 * 지금까지는 경계가 없어서 예상 못 한 데이터 한 건이 화면 전체를 백지로 만들었다.
 * 사용자에게는 무슨 일이 있었고 어디로 갈 수 있는지를 알려주고, 원인은 로그로 남긴다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify({ event: "client.render.failed", digest: error.digest }));
  }, [error]);

  return (
    <section className="page-container page-state">
      <p className="eyebrow">SOMETHING BROKE</p>
      <h1>
        화면을 그리다가
        <br />
        문제가 생겼어요.
      </h1>
      <p>잠시 후 다시 시도해보시고, 계속 같은 화면이 나오면 알려주세요.</p>
      <div className="page-state-actions">
        <button className="button primary" type="button" onClick={reset}>
          다시 시도하기
        </button>
        <Link className="button secondary" href="/dashboard">
          대시보드로 이동
        </Link>
      </div>
    </section>
  );
}
