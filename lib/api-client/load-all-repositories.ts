import type {
  CursorPaginationMeta,
  GitRepositoryDto,
  RepositoryListDto,
  RepositoryListQuery,
} from "@/contracts/api-contract";

/**
 * 저장소 목록 전체를 받아온다.
 *
 * 화면이 limit도 cursor도 넘기지 않아 HTTP 모드에서는 기본값인 20개까지만
 * 보이고 있었다. 라우트가 limit을 50으로 제한하므로 저장소가 그보다 많으면
 * 어차피 여러 번 받아야 한다. 정렬과 언어 집계가 전체 집합을 필요로 하니
 * 한 번에 끝까지 받는다.
 */

/** 라우트가 1~50으로 제한한다. */
const PAGE_SIZE = 50;
/** 커서가 끝나지 않는 경우를 대비한 상한. 저장소 1,000개까지 덮는다. */
const MAX_PAGES = 20;

type FetchPage = (
  query: RepositoryListQuery,
) => Promise<RepositoryListDto & CursorPaginationMeta>;

export async function loadAllRepositories(fetchPage: FetchPage): Promise<GitRepositoryDto[]> {
  const collected: GitRepositoryDto[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetchPage({ limit: PAGE_SIZE, cursor });

    /* 페이지 경계에서 정렬 기준이 같은 행끼리 순서가 흔들리면 같은 저장소가
       두 번 오거나 하나가 빠질 수 있다. id로 한 번 걸러준다. */
    for (const repository of response.repositories) {
      if (seen.has(repository.id)) continue;
      seen.add(repository.id);
      collected.push(repository);
    }

    if (!response.hasNextPage || !response.nextCursor) {
      break;
    }
    cursor = response.nextCursor;
  }

  return collected;
}
