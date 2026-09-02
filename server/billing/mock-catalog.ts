import type {
  BillingProductDto,
  CreditSummaryDto,
  MockCheckoutDto,
  MockPaymentDto,
} from "@/contracts/api-contract";

const INITIAL_CREDIT_BALANCE = 100;
const CREDIT_COST_PER_REPOSITORY = 30;

const billingProducts = [
  {
    id: "credit_100",
    name: "Starter 100",
    description: "포트폴리오 3개를 충분히 실험해볼 수 있어요.",
    credits: 100,
    priceKrw: 9900,
    isFeatured: false,
    isMock: true,
  },
  {
    id: "credit_300",
    name: "Builder 300",
    description: "여러 직무와 프롬프트를 비교하고 싶다면 추천해요.",
    credits: 300,
    priceKrw: 24900,
    isFeatured: true,
    isMock: true,
  },
  {
    id: "credit_700",
    name: "Pro 700",
    description: "다양한 프로젝트를 꾸준히 정리하고 싶다면 넉넉해요.",
    credits: 700,
    priceKrw: 49900,
    isFeatured: false,
    isMock: true,
  },
] as const satisfies readonly BillingProductDto[];

const mockPayments = [
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
] as const satisfies readonly MockPaymentDto[];

function copyProduct(product: BillingProductDto): BillingProductDto {
  return { ...product };
}

function copyPayment(payment: MockPaymentDto): MockPaymentDto {
  return { ...payment };
}

export function getMockCreditSummary(): CreditSummaryDto {
  return {
    balance: INITIAL_CREDIT_BALANCE,
    initialBalance: INITIAL_CREDIT_BALANCE,
    costPerRepository: CREDIT_COST_PER_REPOSITORY,
    chargingEnabled: false,
    isMock: true,
  };
}

export function listMockBillingProducts(): BillingProductDto[] {
  return billingProducts.map(copyProduct);
}

export function listMockPayments(): MockPaymentDto[] {
  return mockPayments.map(copyPayment);
}

export function createMockCheckout(
  productId: string,
  createdAt = new Date().toISOString(),
): MockCheckoutDto | null {
  const product = billingProducts.find((item) => item.id === productId);
  if (!product) {
    return null;
  }

  return {
    checkoutId: `mock_checkout_${product.id}`,
    product: copyProduct(product),
    status: "completed",
    redirectPath: "/billing/success",
    creditBalanceBefore: INITIAL_CREDIT_BALANCE,
    creditBalanceAfter: INITIAL_CREDIT_BALANCE,
    balanceChanged: false,
    isMock: true,
    createdAt,
  };
}
