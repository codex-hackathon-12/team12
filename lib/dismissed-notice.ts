"use client";

import { useSyncExternalStore } from "react";

/**
 * 사용자가 닫은 안내를 기억한다.
 *
 * 실패한 생성은 대시보드 맨 위에 뜬다. 화면을 떠난 사이에 실패하면 알 방법이
 * 없기 때문인데, 이미 본 사람에게는 같은 자리를 계속 차지하는 방해물이다.
 * 서버에서 24시간이 지나면 내려가지만, 그 전에 치울 방법이 있어야 한다.
 *
 * 어디에 기억할지는 이게 무엇인지에 달려 있다. "이 안내를 봤다"는 도메인
 * 데이터가 아니라 보기 상태다. DB 컬럼으로 만들면 마이그레이션이 필요하고
 * 이 저장소의 마이그레이션은 손으로 적용하므로, 적용 전까지 조회가 깨진다.
 * 기기마다 따로 기억되는 것이 이 값의 성격에 맞고, 기기를 옮겨도 24시간
 * 기한이 받아준다.
 */

const KEY = "folio.dismissedGenerationNotice";
const EVENT = "folio:dismissed-notice";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    /* 사파리 프라이빗 모드처럼 저장이 막힌 환경에서는 못 닫을 뿐,
       화면이 깨지지는 않아야 한다. */
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  // storage 이벤트는 다른 탭에서만 발생하므로, 같은 탭용 이벤트를 따로 쏜다.
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/* 서버는 사용자의 저장소를 모르므로 "닫지 않음"으로 시작한다. 이 카드는
   대시보드를 받아온 뒤에야 그려지고 그때는 이미 하이드레이션이 끝나 있어,
   닫은 안내가 잠깐 보이는 일은 실제로 일어나지 않는다. */
const getServerSnapshot = () => null;

export function useDismissedNotice(): string | null {
  return useSyncExternalStore(subscribe, read, getServerSnapshot);
}

export function dismissNotice(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // 저장하지 못해도 이번 화면에서는 닫힌 것으로 보이게 이벤트는 쏜다.
  }
  window.dispatchEvent(new Event(EVENT));
}
