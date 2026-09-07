import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookie";

/**
 * 로그인 라우팅 가드.
 *
 * 갤러리는 공개(결과물 먼저 보기)인데 대시보드 셸 안에 있어, 로그아웃
 * 상태에서도 내비게이션이 보인다. 페이지 층에 가드가 없어서 메뉴를 누르면
 * 대시보드는 빈 화면이 자기 것처럼 열렸고(그 API는 익명에게 빈 목록을
 * 돌려준다), 나머지는 API 401이 예고 없이 GitHub OAuth로 튕겼다 — 가드가
 * 아니라 사고처럼 보였다.
 *
 * 쿠키의 **존재만** 본다. 유효성은 DB를 봐야 해서 edge에서 할 수 없고 할
 * 필요도 없다 — 만료된 쿠키는 통과해도 API 401이 returnTo를 들고 재로그인
 * 으로 보낸다. 층이 나뉜 가드다: 여기는 "로그인 안 한 사람이 화면을 보는
 * 것"을 막고, 401 층은 "세션이 죽은 사람"을 되살린다.
 */
export function middleware(request: NextRequest) {
  /* 목 모드는 세션 쿠키가 없는 게 정상이다. 로컬 개발과 e2e가 전부 목으로
     도는데 여기서 막으면 아무 화면도 못 들어간다. */
  if (process.env.NEXT_PUBLIC_API_MODE !== "http") {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const { pathname, search } = request.nextUrl;
    const landing = new URL("/", request.url);
    /* 로그인하면 보던 화면으로 돌아온다. 랜딩이 이 값을 검증해서 쓴다. */
    landing.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(landing);
  }

  return NextResponse.next();
}

/* 공개 경로는 여기 없다: /(랜딩), /gallery(결과물 먼저 보기),
   /p(공개 링크), /announcements(소식). */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portfolios/:path*",
    "/repositories/:path*",
    "/create/:path*",
    "/billing/:path*",
    "/settings/:path*",
  ],
};
