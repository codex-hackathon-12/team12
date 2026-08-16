import { getGalleryExample } from "@/server/content/catalog";
import { failure, success } from "@/server/http";
import { withApiLogging } from "@/server/observability/api-logging";

async function handleGET(
  request: Request,
  context: { params: Promise<{ exampleId: string }> },
): Promise<Response> {
  void request;
  const { exampleId } = await context.params;
  const example = getGalleryExample(exampleId);
  return example ? success(example) : failure("NOT_FOUND", "갤러리 예시를 찾을 수 없습니다.", 404);
}

export const GET = withApiLogging(
  { domain: "gallery", operation: "gallery.read", route: "/api/v1/gallery/[exampleId]" },
  handleGET,
);
