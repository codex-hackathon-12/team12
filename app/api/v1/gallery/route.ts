import { decodeContentCursor, listGalleryExamples } from "@/server/content/catalog";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function parseLimit(value: string | null): number | null {
  if (value === null) {
    return DEFAULT_LIMIT;
  }

  if (!/^[1-9]\d*$/u.test(value)) {
    return null;
  }

  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit <= MAX_LIMIT ? limit : null;
}

function parseFilter(value: string | null): string | null {
  if (value === null) {
    return "";
  }

  const filter = value.trim();
  return filter.length <= 100 ? filter : null;
}

async function handleGET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = decodeContentCursor(url.searchParams.get("cursor"));
  const role = parseFilter(url.searchParams.get("role"));
  const techStack = parseFilter(url.searchParams.get("techStack"));

  if (limit === null || cursor === null || role === null || techStack === null) {
    return failure("VALIDATION_ERROR", "갤러리 목록 조회 값이 올바르지 않습니다.", 400);
  }

  const result = listGalleryExamples({
    role: role || undefined,
    techStack: techStack || undefined,
    offset: cursor,
    limit,
  });

  return success(
    { examples: result.items },
    200,
    { nextCursor: result.nextCursor, hasNextPage: result.hasNextPage },
  );
}

export const GET = withApiLogging(
  { domain: "gallery", operation: "gallery.list", route: "/api/v1/gallery" },
  handleGET,
);
