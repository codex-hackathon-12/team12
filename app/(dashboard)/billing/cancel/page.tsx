import Link from "next/link";
import { MOCK_NOTE } from "@/lib/copy";
import { LABEL } from "@/lib/copy";

export default function BillingCancelPage() {
  return (
    <section className="page-container billing-result page-state">
      <div className="result-symbol muted" aria-hidden="true">×</div>
      <p className="eyebrow">CHECKOUT CANCELED</p>
      <h1>결제 체험을<br />중단했어요.</h1>
      <p>{MOCK_NOTE}</p>
      <div className="page-state-actions">
        <Link className="button primary" href="/billing">다시 선택하기</Link>
        <Link className="button secondary" href="/dashboard">{LABEL.dashboard}로 이동</Link>
      </div>
    </section>
  );
}
