import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <section className="page-container billing-result page-state">
      <div className="result-symbol muted" aria-hidden="true">×</div>
      <p className="eyebrow">CHECKOUT CANCELED</p>
      <h1>결제 체험을<br />중단했어요.</h1>
      <p>mock 흐름이므로 결제와 잔액에는 아무 변화가 없습니다.</p>
      <div className="page-state-actions">
        <Link className="button primary" href="/billing">다시 선택하기</Link>
        <Link className="button secondary" href="/dashboard">대시보드로 이동</Link>
      </div>
    </section>
  );
}
