"use client";

/**
 * 인쇄 대화상자를 여는 버튼.
 *
 * 서버 컴포넌트인 공개 페이지에서도 쓸 수 있도록 이것만 클라이언트로 떼어 둔다.
 * 문서가 A4 세로 규격이라 인쇄 대화상자의 "PDF로 저장"이 곧 PDF 내려받기다.
 * 서버에서 PDF를 만들지 않는 이유가 이것이다.
 */
export function PrintButton({ className = "button primary" }: { className?: string }) {
  return (
    <button className={className} type="button" onClick={() => window.print()}>
      인쇄 · PDF로 저장
    </button>
  );
}
