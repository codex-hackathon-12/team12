"use client";

import { useCallback, useEffect, useState } from "react";

type State<TData> = {
  data: TData | null;
  /** 실패했을 때만 채워진다. 로딩 중인지와 구분하려면 이 값을 본다. */
  error: string | null;
  /** 이 데이터가 어떤 조건으로 받아온 것인지. 조건이 바뀌면 낡은 값이 된다. */
  key: string;
};

export type AsyncData<TData> = {
  data: TData | null;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
};

/**
 * 화면 진입 시 한 번 읽고, 실패를 화면에 드러내고, 다시 시도할 수 있게 한다.
 *
 * 지금까지는 페이지마다 관행이 달랐다. 어떤 화면은 실패를 잡아 안내했고, 어떤
 * 화면은 catch가 없어 영원히 스피너가 돌았다. 응답이 늦게 도착해 최신 화면을
 * 덮어쓰는 경쟁 상태도 화면마다 각자 처리하거나 아예 처리하지 않았다.
 * 한 곳으로 모아 규칙을 하나로 만든다.
 *
 * 데이터와 실패를 한 덩어리로 두는 이유는 이펙트 안에서 상태를 미리 비우지
 * 않기 위해서다. 비동기 결과가 도착할 때 한 번만 쓴다.
 */
export function useAsyncData<TData>(
  loader: () => Promise<TData>,
  dependencies: unknown[],
  errorMessage: string,
): AsyncData<TData> {
  const [state, setState] = useState<State<TData>>({ data: null, error: null, key: "" });
  const [attempt, setAttempt] = useState(0);

  /* 조건이 바뀌었는데 아직 새 결과가 오지 않았다면 지금 들고 있는 값은 낡은 것이다.
     갤러리에서 필터를 바꾸면 이전 직무의 카드가 그대로 남아 클릭까지 됐다.
     이펙트로 비우면 렌더 중 setState가 되므로, 렌더 시점에 파생해서 판단한다. */
  const key = JSON.stringify(dependencies) + `#${attempt}`;
  const isStale = state.key !== key;

  useEffect(() => {
    let active = true;
    loader()
      .then((result) => {
        if (active) setState({ data: result, error: null, key });
      })
      .catch(() => {
        if (active) setState({ data: null, error: errorMessage, key });
      });
    return () => {
      // 늦게 도착한 응답이 최신 결과를 덮지 않게 한다.
      active = false;
    };
    // loader는 렌더마다 새로 만들어지므로 의존성에 넣으면 매번 다시 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, attempt, errorMessage]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    data: isStale ? null : state.data,
    error: isStale ? null : state.error,
    isLoading: isStale || (state.data === null && state.error === null),
    reload,
  };
}
