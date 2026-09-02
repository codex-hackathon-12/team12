/**
 * 라벨이 바뀌어도 버튼 폭이 그대로인 표시.
 *
 * 버튼 라벨은 상태에 따라 바뀐다 — `삭제` ↔ `삭제 중…`, `로그아웃` ↔
 * `로그아웃 중…`. `.button`에 폭 하한이 없어 폭이 곧 글자 수이고, 라벨이
 * 바뀌는 순간 버튼이 커지면서 옆 버튼들이 통째로 밀렸다. 오른쪽 정렬이든
 * 가운데 정렬이든 마찬가지고, 형제가 없어도 방금 누른 자리가 커서 밑에서
 * 움직인다.
 *
 * 가능한 라벨을 전부 같은 그리드 칸에 겹쳐 두고 현재 것만 보이게 한다.
 * 칸 폭은 가장 넓은 라벨을 따르므로 어떤 상태에서도 같다. px를 적어두는
 * 방식과 달리 글자를 고쳐도 폭이 알아서 따라온다.
 *
 * 상태를 갖지 않는 순수 표시 컴포넌트라 클라이언트 지시자가 필요 없다.
 */
export function SteadyLabel({ value, states }: { value: string; states: string[] }) {
  return (
    <span className="steady-label">
      {states.map((state) => (
        /* 자리만 차지하는 사본. visibility: hidden이라 낭독기에서도 빠지지만,
           의도를 코드에 남기려고 aria-hidden도 함께 적는다. */
        <span aria-hidden="true" className="steady-label-ghost" key={state}>
          {state}
        </span>
      ))}
      <span className="steady-label-value">{value}</span>
    </span>
  );
}
