"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 인라인 확인 UI가 열리고 닫힐 때 포커스를 잃지 않게 한다.
 *
 * "삭제"를 누르면 그 버튼이 사라지고 확인 줄이 대신 나타난다. 사라진 버튼에
 * 있던 포커스는 body로 떨어지므로, 키보드 사용자는 확인 버튼에 닿기 위해 카드
 * 목록을 처음부터 다시 훑어야 했다. 취소해도 마찬가지였다.
 *
 * 열릴 때는 확인 버튼으로 옮기고, 닫힐 때는 원래 눌렀던 자리로 돌려준다.
 */
export function useReturnFocus(isOpen: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      confirmRef.current?.focus();
    } else if (!isOpen && wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  /** 확인이 끝나 화면을 떠나는 경우엔 되돌릴 자리가 없으므로 복귀를 끈다. */
  const cancelReturn = useCallback(() => {
    wasOpen.current = false;
  }, []);

  return { triggerRef, confirmRef, cancelReturn };
}
