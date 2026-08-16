"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  BillingProductDto,
  CreditSummaryDto,
  MockPaymentDto,
} from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));

export default function BillingPage() {
  const router = useRouter();
  const [credits, setCredits] = useState<CreditSummaryDto | null>(null);
  const [products, setProducts] = useState<BillingProductDto[] | null>(null);
  const [payments, setPayments] = useState<MockPaymentDto[]>([]);
  const [selected, setSelected] = useState("credit_300");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.getCredits(),
      apiClient.getBillingProducts(),
      apiClient.getPayments(),
    ]).then(([creditData, productData, paymentData]) => {
      setCredits(creditData);
      setProducts(productData.products);
      setPayments(paymentData.payments);
    });
  }, []);

  const checkout = async () => {
    setSubmitting(true);
    const result = await apiClient.createCheckout({ productId: selected });
    router.push(`${result.redirectPath}?checkoutId=${result.checkoutId}`);
  };

  if (!credits || !products) return <LoadingState label="크레딧 정보를 준비하고 있어요" />;

  return (
    <div className="page-container billing-page">
      <header className="page-heading billing-heading">
        <div>
          <p className="eyebrow">CREDITS · MOCK BILLING</p>
          <h1>필요할 때,<br />필요한 만큼만.</h1>
        </div>
        <div className="credit-balance-card">
          <span>현재 보유 크레딧</span>
          <strong>{credits.balance}<small> credits</small></strong>
          <p>포트폴리오 1회 예상 비용은 {credits.costPerRepository}크레딧입니다.</p>
        </div>
      </header>

      <div className="mock-notice" role="note">
        <span>DEMO MODE</span>
        <p>현재는 결제 흐름을 확인하기 위한 화면입니다. 실제 결제와 크레딧 지급 또는 차감은 발생하지 않아요.</p>
      </div>

      <section className="billing-products">
        <div className="section-title-row compact-title">
          <div>
            <p className="eyebrow">CHOOSE A PACK</p>
            <h2>크레딧 상품</h2>
          </div>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <button
              className={`product-card ${selected === product.id ? "selected" : ""} ${product.isFeatured ? "featured" : ""}`}
              type="button"
              key={product.id}
              onClick={() => setSelected(product.id)}
            >
              {product.isFeatured && <span className="recommended-label">MOST POPULAR</span>}
              <span className="product-radio" aria-hidden="true" />
              <div>
                <span className="mono-label">{product.name}</span>
                <strong>{product.credits}<small> credits</small></strong>
                <p>{product.description}</p>
              </div>
              <span className="product-price">{formatPrice(product.priceKrw)}</span>
            </button>
          ))}
        </div>
        <button className="button primary checkout-button" type="button" onClick={checkout} disabled={submitting}>
          {submitting ? "Mock 결제 처리 중…" : "선택한 상품으로 결제 체험하기"}
          {!submitting && <span aria-hidden="true">→</span>}
        </button>
      </section>

      <section className="payment-history">
        <div className="section-title-row compact-title">
          <div>
            <p className="eyebrow">HISTORY</p>
            <h2>최근 결제 내역</h2>
          </div>
          <span>Mock data</span>
        </div>
        {payments.map((payment) => (
          <div className="payment-row" key={payment.id}>
            <span className="success-check">✓</span>
            <div>
              <strong>{payment.productName}</strong>
              <span>{formatDate(payment.createdAt)} · 체험 완료</span>
            </div>
            <strong>{formatPrice(payment.priceKrw)}</strong>
            <span className="mock-badge">잔액 변동 없음</span>
          </div>
        ))}
      </section>
    </div>
  );
}
