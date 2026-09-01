import Link from "next/link";

/**
 * 공유 링크로 들어왔는데 열 수 없는 경우다.
 *
 * 링크를 받은 사람은 무엇이 잘못됐는지 알 방법이 없다. 맨 404 화면은
 * "주소를 잘못 받았나" 하고 보낸 사람에게 되묻게 만든다. 비공개로 바뀌었을
 * 수 있다는 사정을 알려주면 다음 행동이 분명해진다.
 */
export default function PublicPortfolioNotFound() {
  return (
    <main className="page-container page-state">
      <p className="eyebrow">LINK UNAVAILABLE</p>
      <h1>
        지금은 볼 수 없는
        <br />
        포트폴리오예요.
      </h1>
      <p>
        링크가 잘못됐거나, 만든 사람이 공개를 내렸을 수 있어요. 링크를 보낸 분에게
        다시 공개해달라고 요청해보세요.
      </p>
      <div className="page-state-actions">
        <Link className="button primary" href="/">
          folio.ai 둘러보기
        </Link>
        <Link className="button secondary" href="/gallery">
          완성된 예시 보기
        </Link>
      </div>
    </main>
  );
}
