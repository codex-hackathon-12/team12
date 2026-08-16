import { decodeContentCursor, listAnnouncements } from "@/server/content/catalog";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

const DEFAULT_LIMIT = 10;
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

async function handleGET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = decodeContentCursor(url.searchParams.get("cursor"));

  if (limit === null || cursor === null) {
    return failure("VALIDATION_ERROR", "공지 목록 조회 값이 올바르지 않습니다.", 400);
  }

  const result = listAnnouncements({ offset: cursor, limit });
  return success(
    { announcements: result.items },
    200,
    { nextCursor: result.nextCursor, hasNextPage: result.hasNextPage },
  );
}

export const GET = withApiLogging(
  { domain: "announcements", operation: "announcement.list", route: "/api/v1/announcements" },
  handleGET,
);
