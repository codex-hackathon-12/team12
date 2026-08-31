/**
 * 테스트에서 `@/` 별칭을 풀어준다.
 *
 * tsconfig의 paths는 Node가 읽지 않으므로, 값 import로 `@/`를 쓰는 서버 모듈은
 * 여태 테스트에서 불러올 수 없었다. 그래서 순수 함수만, 그것도 타입 import만 있는
 * 파일만 테스트되고 있었다. 프로덕션 코드를 테스트 때문에 바꾸는 대신
 * 테스트 쪽에서 해석기를 붙인다.
 *
 * 사용: node --test --import ./tests/register-alias.mjs tests/*.test.mjs
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../", import.meta.url);

// tsconfig가 확장자 없는 import를 허용하므로 여기서도 같은 순서로 찾아준다.
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

function resolveAlias(specifier) {
  const base = new URL(specifier.slice(2), projectRoot);
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = new URL(base.href + suffix);
    if (existsSync(fileURLToPath(candidate))) {
      return candidate.href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const url = resolveAlias(specifier);
      if (url) {
        return { url, format: undefined, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
