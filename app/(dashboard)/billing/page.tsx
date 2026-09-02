"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  BillingProductDto,
  GitHubUserDto,
  MockPaymentDto,
} from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { formatLongDay } from "@/lib/format";
import { LoadingState } from "@/components/ui/LoadingState";
import { MOCK_CHIP, MOCK_NOTE } from "@/lib/copy";
import { LABEL } from "@/lib/copy";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price);


export default function BillingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<BillingProductDto[] | null>(null);
  const [payments, setPayments] = useState<MockPaymentDto[]>([]);
  const [user, setUser] = useState<GitHubUserDto | null>(null);
  const [selected, setSelected] = useState("credit_300");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.getBillingProducts(),
      apiClient.getPayments(),
      apiClient.getSession(),
    ])
      .then(([productData, paymentData, session]) => {
        if (!active) return;
        setProducts(productData.products);
        setPayments(paymentData.payments);
        setUser(session.user);
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

  if (!products) return <LoadingState label="크레딧 정보를 불러오고 있어요" />;

  return (
    <div className="page-container billing-page">
        {/* 이 화면들은 시각적 제목이 없는 디자인이다. 화면에서는 내비게이션이
            강조돼 지금 어디인지 알 수 있지만, 낭독기에는 그 단서가 없다.
            제목 하나로 이동하는 사용자에게 화면 이름을 준다(SC 2.4.6).
            내비게이션 라벨과 같은 말을 써야 눌러서 온 링크와 이어진다. */}
        <h1 className="sr-only">{LABEL.billing}</h1>
      <section className="billing-products">
        <div className="section-title-row compact-title">
          <div>
            <p className="eyebrow">CHOOSE A PACK</p>
            <h2>크레딧 상품</h2>
          </div>
        </div>
        {/* 잔액은 헤더 칩에만 있었고 그 칩은 780px 아래에서 숨는다. 모바일에서는
            얼마나 남았는지 모르는 채로 구매 화면에 서게 된다. 사야 하는지 판단할
            근거를 결정하는 자리에 둔다. */}
        {user ? (
          <div className="credit-balance-card">
            <span>남은 크레딧</span>
            <strong>{user.creditBalance}<small> credits</small></strong>
            <p>포트폴리오 한 번 만들 때 1 크레딧을 써요. {MOCK_NOTE}</p>
          </div>
        ) : null}
        {/* 하나만 고르는 묶음인데 선택 여부가 클래스에만 있었다. 화면 낭독기로는
            어떤 상품이 결제되는지 알 수 없었고, 결제 직전 화면이다.
            진짜 라디오로 만들면 화살표 이동과 상태 전달이 공짜로 따라온다. */}
        <fieldset className="product-grid">
          <legend className="sr-only">크레딧 상품 선택</legend>
          {products.map((product) => (
            <label
              className={`product-card ${product.isFeatured ? "featured" : ""}`}
              key={product.id}
            >
              <input
                type="radio"
                name="product"
                className="sr-only"
                value={product.id}
                checked={selected === product.id}
                onChange={() => setSelected(product.id)}
              />
              {product.isFeatured && <span className="recommended-label">MOST POPULAR</span>}
              <span className="product-radio" aria-hidden="true" />
              <div>
                <span className="mono-label">{product.name}</span>
                <strong>{product.credits}<small> credits</small></strong>
                <p>{product.description}</p>
              </div>
              <span className="product-price">{formatPrice(product.priceKrw)}</span>
            </label>
          ))}
        </fieldset>
        <button className="button primary checkout-button" type="button" onClick={checkout} disabled={submitting}>
          {submitting ? "결제 체험 처리 중…" : "선택한 상품으로 결제 체험하기"}
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
          <span>{MOCK_CHIP}</span>
        </div>
        {payments.map((payment) => (
          <div className="payment-row" key={payment.id}>
            <span className="success-check">✓</span>
            <div>
              <strong>{payment.productName}</strong>
              <span>{formatLongDay(payment.createdAt)} · 체험 완료</span>
            </div>
            <strong>{formatPrice(payment.priceKrw)}</strong>
            <span className="mock-badge">차감 없음</span>
          </div>
        ))}
      </section>
    </div>
  );
}
