"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  BillingProductDto,
  MockPaymentDto,
} from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { formatLongDay } from "@/lib/format";
import { LoadingState } from "@/components/ui/LoadingState";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);


export default function BillingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<BillingProductDto[] | null>(null);
  const [payments, setPayments] = useState<MockPaymentDto[]>([]);
  const [selected, setSelected] = useState("credit_300");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([apiClient.getBillingProducts(), apiClient.getPayments()])
      .then(([productData, paymentData]) => {
        if (!active) return;
        setProducts(productData.products);
        setPayments(paymentData.payments);
        setLoadError(null);
      })
      .catch(() => {
        if (active) setLoadError("크레딧 정보를 불러오지 못했어요.");
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const checkout = async () => {
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const result = await apiClient.createCheckout({ productId: selected });
      router.push(`${result.redirectPath}?checkoutId=${result.checkoutId}`);
    } catch {
      // 실패했는데 버튼이 잠긴 채로 남으면 사용자는 결제가 걸린 줄 안다.
      setCheckoutError("결제 체험을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">LOAD FAILED</p>
        <h1>{loadError}</h1>
        <div className="page-state-actions">
          <button
            className="button primary"
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            다시 불러오기
          </button>
        </div>
      </section>
    );
  }

  if (!products) return <LoadingState label="크레딧 정보를 준비하고 있어요" />;

  return (
    <div className="page-container billing-page">
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
        {checkoutError ? <p className="inline-error" role="alert">{checkoutError}</p> : null}
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
              <span>{formatLongDay(payment.createdAt)} · 체험 완료</span>
            </div>
            <strong>{formatPrice(payment.priceKrw)}</strong>
            <span className="mock-badge">잔액 변동 없음</span>
          </div>
        ))}
      </section>
    </div>
  );
}
