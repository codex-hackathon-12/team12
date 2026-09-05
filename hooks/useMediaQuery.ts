"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 미디어 쿼리가 맞는지 렌더에서 읽는다.
 *
 * 서버는 화면 폭을 모른다. 맞는다고 가정하고 그렸다가 좁은 화면에서 되돌리면
 * 첫 화면이 번쩍이므로, 모를 때는 **맞지 않는 쪽**에서 시작한다. 이 규칙을
 * 화면마다 다시 쓰면 어딘가는 반대로 가정하게 된다.
 *
 * 이펙트로 상태에 복사하지 않는다. 복사하면 첫 렌더와 실제 화면이 한 번 어긋나고,
 * 그 사이에 잰 값(예: A4 낱장 높이)이 틀린 채로 굳는다.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
