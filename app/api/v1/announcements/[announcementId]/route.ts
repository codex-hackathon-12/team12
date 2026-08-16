import { getAnnouncement } from "@/server/content/catalog";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(
  request: Request,
  context: { params: Promise<{ announcementId: string }> },
): Promise<Response> {
  void request;
  const { announcementId } = await context.params;
  const announcement = getAnnouncement(announcementId);
  return announcement ? success(announcement) : failure("NOT_FOUND", "공지 또는 이벤트를 찾을 수 없습니다.", 404);
}

export const GET = withApiLogging(
  { domain: "announcements", operation: "announcement.read", route: "/api/v1/announcements/[announcementId]" },
  handleGET,
);
