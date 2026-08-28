import type { PortfolioShareDto } from "@/contracts/api-contract";

/**
 * 슬러그는 사람이 읽을 수 있는 앞부분과 짧은 임의 접미사로 만든다.
 * 접미사가 있어야 같은 이름·직무로 여러 개를 만들어도 충돌하지 않는다.
 */
const SLUG_FALLBACK = "portfolio";
const SLUG_BASE_MAX = 40;
const SUFFIX_LENGTH = 6;

/**
 * 한글이나 기호를 그대로 두면 URL이 퍼센트 인코딩으로 지저분해진다.
 * 영문·숫자만 남기고, 남는 게 없으면 고정 문자열을 쓴다.
 */
export function toSlugBase(...parts: Array<string | null | undefined>): string {
  const base = parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, SLUG_BASE_MAX)
    .replace(/-+$/u, "");

  return base || SLUG_FALLBACK;
}

function randomSuffix(): string {
  // 새 의존성 없이 충분히 흩어지는 값을 만든다.
  const bytes = crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH));
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

export function buildPortfolioSlug(
  displayName: string | null | undefined,
  targetRole: string | null | undefined,
): string {
  return `${toSlugBase(displayName, targetRole)}-${randomSuffix()}`;
}

export function buildShareUrl(slug: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/u, "")}/p/${slug}`;
}

/**
 * 저장된 행에서 공유 상태를 만든다.
 * 비공개일 때 URL을 비우는 이유는, 화면이 실수로 죽은 링크를 보여주지 않게 하기 위함이다.
 */
export function toShareDto(
  record: { public_slug: string | null; published_at: string | null },
  baseUrl: string,
): PortfolioShareDto {
  const published = Boolean(record.published_at);
  return {
    published,
    slug: record.public_slug,
    url: published && record.public_slug ? buildShareUrl(record.public_slug, baseUrl) : null,
  };
}
