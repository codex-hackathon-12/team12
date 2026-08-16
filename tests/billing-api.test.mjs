import assert from "node:assert/strict";
import test from "node:test";

const {
  createMockCheckout,
  getMockCreditSummary,
  listMockBillingProducts,
  listMockPayments,
} = await import(new URL("../server/billing/mock-catalog.ts", import.meta.url));

test("returns the fixed MVP credit policy", () => {
  assert.deepEqual(getMockCreditSummary(), {
    balance: 100,
    initialBalance: 100,
    costPerRepository: 30,
    chargingEnabled: false,
    isMock: true,
  });
});

test("returns the static mock billing product and payment catalogs", () => {
  const products = listMockBillingProducts();
  const payments = listMockPayments();

  assert.deepEqual(
    products.map((product) => product.id),
    ["credit_100", "credit_300", "credit_700"],
  );
  assert.equal(products[1].isFeatured, true);
  assert.deepEqual(payments, [
    {
      id: "mock_payment_01",
      productName: "Starter 100",
      priceKrw: 9900,
      credits: 100,
      status: "mockCompleted",
      balanceChanged: false,
      isMock: true,
      createdAt: "2026-08-10T05:30:00.000Z",
    },
  ]);
});

test("creates a completed mock checkout without changing the balance", () => {
  const checkout = createMockCheckout("credit_300", "2026-08-16T04:00:00.000Z");

  assert.deepEqual(checkout, {
    checkoutId: "mock_checkout_credit_300",
    product: {
      id: "credit_300",
      name: "Builder 300",
      description: "여러 직무와 프롬프트를 비교하고 싶다면 추천해요.",
      credits: 300,
      priceKrw: 24900,
      isFeatured: true,
      isMock: true,
    },
    status: "completed",
    redirectPath: "/billing/success",
    creditBalanceBefore: 100,
    creditBalanceAfter: 100,
    balanceChanged: false,
    isMock: true,
    createdAt: "2026-08-16T04:00:00.000Z",
  });
});

test("rejects an unknown mock billing product", () => {
  assert.equal(createMockCheckout("credit_unknown", "2026-08-16T04:00:00.000Z"), null);
});
