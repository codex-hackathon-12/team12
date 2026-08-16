export function LoadingState({ label = "데이터를 불러오고 있어요" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-mark" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
