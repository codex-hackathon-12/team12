import Link from "next/link";
import { LABEL } from "@/lib/copy";
import { MOCK_NOTE } from "@/lib/copy";

export default function BillingSuccessPage() {
  return (
    <section className="page-container billing-result page-state">
      <div className="result-symbol" aria-hidden="true">✓</div>
      <p className="eyebrow">MOCK CHECKOUT COMPLETE</p>
      <h1>결제 흐름을<br />끝까지 확인했어요.</h1>
      <p>{MOCK_NOTE}</p>
      <div className="page-state-actions">
        <Link className="button primary" href="/repositories">{LABEL.create}</Link>
        <Link className="button secondary" href="/billing">{LABEL.billing}으로 돌아가기</Link>
      </div>
    </section>
  );
}
