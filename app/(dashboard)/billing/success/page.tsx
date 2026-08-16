import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <section className="page-container billing-result page-state">
      <div className="result-symbol" aria-hidden="true">✓</div>
      <p className="eyebrow">MOCK CHECKOUT COMPLETE</p>
      <h1>결제 흐름을<br />끝까지 확인했어요.</h1>
      <p>실제 승인이나 크레딧 지급은 발생하지 않았습니다. 잔액은 100크레딧으로 유지돼요.</p>
      <div className="page-state-actions">
        <Link className="button primary" href="/repositories">포트폴리오 만들기</Link>
        <Link className="button secondary" href="/billing">상품으로 돌아가기</Link>
      </div>
    </section>
  );
}
