"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type {
  PortfolioContentDto,
  PortfolioQuestionDto,
  PortfolioShareDto,
  PortfolioStatementResultDto,
} from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReturnFocus } from "@/hooks/useReturnFocus";
import { FollowUpRail, type RailProject } from "@/components/portfolio/FollowUpRail";
import { PortfolioDocument } from "@/components/portfolio/PortfolioDocument";
import { LoadingState } from "@/components/ui/LoadingState";
import { LABEL } from "@/lib/copy";
import { SteadyLabel } from "@/components/ui/SteadyLabel";

/** 공유 자리에 나올 수 있는 문구 전부. 가장 넓은 것이 칸 폭을 정한다. */
const SHARE_LABELS = ["공개 링크 만들기", "공개하는 중…", "링크 복사", "복사됨"];

export default function PortfolioResultPage() {
  const params = useParams<{ portfolioId: string }>();
  const router = useRouter();
  const portfolioId = String(params.portfolioId);
  const { data: portfolio, error: loadError, reload } = useAsyncData(
    () => apiClient.getPortfolio(portfolioId),
    [portfolioId],
    "포트폴리오를 불러오지 못했어요.",
  );
  /* 되묻기 반영은 서버 응답이 출발점이고, 성공했을 때만 덮어쓴다. 공개 상태와
     같은 규칙이다 — 이펙트로 복사해두면 두 값이 어긋난다. */
  const [rewritten, setRewritten] = useState<{
    content: PortfolioContentDto;
    questions: PortfolioQuestionDto[];
  } | null>(null);
  /* 옆에 둘 자리가 있으면 열린 채로 시작한다. 접혀서 시작하면 있는 줄도
     모른다. 좁은 화면에서는 패널이 아래에서 올라와 문서를 덮으므로, 열려고
     누른 사람에게만 연다. 사용자가 한 번 정하면 그 선택을 따른다. */
  const roomForRail = useMediaQuery("(min-width: 1101px)");
  const [railChoice, setRailChoice] = useState<boolean | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /* 공개 상태는 서버 응답이 출발점이고, 전환에 성공했을 때만 덮어쓴다.
     이펙트로 복사해두면 두 값이 어긋날 수 있다. */
  const [shareOverride, setShareOverride] = useState<PortfolioShareDto | null>(null);
  const share = shareOverride ?? portfolio?.share ?? null;
  const [sharing, setSharing] = useState(false);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /* 훅이 돌려주는 객체를 JSX에서 점으로 꺼내면 린터가 렌더 중 ref 접근으로 본다.
     여기서 풀어 둔다. */
  const {
    triggerRef: unpublishTriggerRef,
    confirmRef: unpublishConfirmRef,
  } = useReturnFocus(confirmingUnpublish);
  const {
    triggerRef: deleteTriggerRef,
    confirmRef: deleteConfirmRef,
    cancelReturn: cancelDeleteReturn,
  } = useReturnFocus(confirmingDelete);

  if (loadError) {
    return (
      <section className="page-container page-state">
        <p className="eyebrow">LOAD FAILED</p>
        <h1>{loadError}</h1>
        <div className="page-state-actions">
          <button className="button primary" type="button" onClick={reload}>다시 불러오기</button>
          <Link className="button secondary" href="/portfolios">{LABEL.portfolios}로 돌아가기</Link>
        </div>
      </section>
    );
  }

  if (!portfolio) return <LoadingState label="포트폴리오를 불러오고 있어요" />;

  /* 문서의 프로젝트에는 저장소 이름이 없다. 화면에 필요한 것만 담아
     repositoryUrl만 남기기 때문이다. 질문은 이름으로 오므로 여기서 잇는다. */
  const repositoryNameByUrl = new Map(
    portfolio.repositories.map((repository) => [repository.htmlUrl, repository.name]),
  );
  const openQuestions = (rewritten?.questions ?? portfolio.questions)
    .filter((question) => !question.answer);
  const applyResult = (result: PortfolioStatementResultDto) => {
    setRewritten({ content: result.content, questions: result.questions });
    /* 대화가 시작됐으면 사용자가 직접 닫기 전까지 열어 둔다. 이게 없으면
       railOpen의 기본값이 "남은 질문이 있는가"에서 매번 다시 계산돼, 마지막
       답이 반영되는 순간 패널이 대화 도중 사라진다 — 마무리 인사도, 무엇이
       반영됐다는 알림도 못 본 채로. */
    setRailChoice((choice) => choice ?? true);
  };

  const content = rewritten?.content ?? portfolio.content;
  /* 대화창이 질문을 문서 순서로 묻도록 여기서 정렬한다. 목록 순서를 그대로
     쓰면 프로젝트를 오가며 물어 어느 이야기인지 좇기 어렵다. */
  const railProjects: RailProject[] = content.projects.flatMap((project) => {
    const name = repositoryNameByUrl.get(project.repositoryUrl);
    return name ? [{ url: project.repositoryUrl, name, title: project.title }] : [];
  });
  const order = new Map(railProjects.map((project, index) => [project.name, index]));
  const railQuestions = [...(rewritten?.questions ?? portfolio.questions)].sort(
    (a, b) => (order.get(a.repositoryName ?? "") ?? 99) - (order.get(b.repositoryName ?? "") ?? 99),
  );
  const markedUrls = railProjects
    .filter((project) => openQuestions.some((question) => question.repositoryName === project.name))
    .map((project) => project.url);

  /* 처음에는 답할 것이 있고 옆에 자리가 있을 때만 연다. 사용자가 한 번
     정하면 그 선택을 따른다 — 닫은 것도 선택이다. */
  const railOpen = (railChoice ?? (roomForRail && openQuestions.length > 0))
    && railQuestions.length > 0;

  const railToggleLabel = railOpen
    ? "질문 닫기"
    : openQuestions.length > 0
      ? `질문 ${openQuestions.length}개 답하기`
      : "답한 질문 보기";
  /* 두 문구의 폭이 달라 그대로 바꾸면 옆 버튼들이 밀린다. */
  const railToggleLabels = [
    "질문 닫기",
    `질문 ${openQuestions.length}개 답하기`,
    "답한 질문 보기",
  ];

  const sourceLabel = portfolio.repositories.length > 1
    ? `${portfolio.repository.fullName} 외 ${portfolio.repositories.length - 1}개`
    : portfolio.repository.fullName;

  /* 실패해도 진행 표시를 반드시 되돌린다. 되돌리지 않으면 버튼이 영영
     "삭제 중…"에 머물러 사용자가 다시 시도할 수 없다. */
  const remove = async () => {
    // aria-disabled는 클릭을 막지 않는다. 중복 실행은 여기서 막는다.
    if (deleting) return;
    setDeleting(true);
    cancelDeleteReturn();
    setActionError(null);
    try {
      await apiClient.deletePortfolio(portfolio.id);
      router.push("/dashboard");
    } catch {
      setActionError("삭제하지 못했어요. 잠시 후 다시 시도해주세요.");
      setDeleting(false);
    }
  };

  const togglePublish = async (published: boolean) => {
    if (sharing) return;
    setSharing(true);
    setCopied(false);
    setActionError(null);
    try {
      setShareOverride(await apiClient.updatePortfolioShare(portfolio.id, published));
      setConfirmingUnpublish(false);
    } catch {
      setActionError("공개 설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSharing(false);
    }
  };

  // 클립보드는 보안 컨텍스트가 아니거나 권한이 없으면 그대로 실패한다.
  const copyLink = async () => {
    if (!share?.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
    } catch {
      setActionError("링크를 복사하지 못했어요. 주소를 직접 선택해 복사해주세요.");
    }
  };

  return (
    /* 대화창이 열리면 문서와 두 칸으로 나눈다. 자리를 나눠야 대화창이 문서
       흐름 안에서 sticky로 따라올 수 있다. 겹쳐 띄우면 읽으면서 답할 수 없고,
       고정으로 띄우면 페이지의 일부가 아니라 위에 얹힌 판이 된다. */
    <div className={railOpen ? "result-page with-rail" : "result-page"}>
      <div className="result-main">
      <div className="page-container result-toolbar">
        <div>
          <span className="success-check" aria-hidden="true">✓</span>
          <div>
            <p>생성이 완료됐어요</p>
            <strong>{sourceLabel}</strong>
          </div>
        </div>
        {/*
          확인 묶음은 트리거 버튼보다 훨씬 넓다. 예전에는 이것이 형제와 같은
          줄에 끼어들어, 삭제를 누르면 옆 버튼들이 186px, 공개 링크를 만들면
          359px 왼쪽으로 튀었다. 좁은 화면에서는 줄이 접히며 문서가 122px
          아래로 내려갔다.

          확인 중에는 이 행을 확인 묶음이 통째로 넘겨받는다. 형제가 없으니
          밀릴 것도 없고, 되돌릴 수 없는 결정에 주의가 모인다. 취소하면
          전부 돌아온다.
        */}
        <div className="result-actions">
          {confirmingDelete ? (
            <span className="delete-confirm" role="status">
              <strong>되돌릴 수 없어요.</strong>
              <button
                className="button danger"
                type="button"
                ref={deleteConfirmRef}
                aria-disabled={deleting}
                onClick={remove}
              >
                <SteadyLabel
                  states={["삭제할게요", "삭제 중…"]}
                  value={deleting ? "삭제 중…" : "삭제할게요"}
                />
              </button>
              <button
                className="text-link"
                type="button"
                aria-disabled={deleting}
                onClick={() => setConfirmingDelete(false)}
              >
                취소
              </button>
            </span>
          ) : (
            <>
              {/* 공유 자리는 네 가지 문구를 오간다. 한 칸에 모아 가장 넓은 문구로
                  예약해두면 공개 전후로도 폭이 안 변한다. 되돌리기(비공개로)는
                  자기가 되돌릴 대상인 주소 옆으로 내려간다. */}
              {share?.published ? (
                <button className="button secondary" type="button" onClick={copyLink}>
                  <SteadyLabel
                    states={SHARE_LABELS}
                    value={copied ? "복사됨" : "링크 복사"}
                  />
                </button>
              ) : (
                <button
                  className="button secondary"
                  type="button"
                  aria-disabled={sharing}
                  onClick={() => togglePublish(true)}
                >
                  <SteadyLabel
                    states={SHARE_LABELS}
                    value={sharing ? "공개하는 중…" : "공개 링크 만들기"}
                  />
                </button>
              )}
              {/* 닫은 대화를 다시 여는 자리. 예전에는 "답할 것 N개"라고만 적어
                  개수를 알리는 배지처럼 보였고, 누를 수 있는 것으로 읽히지
                  않아 한 번 닫으면 다시 못 여는 화면이 됐다. 무엇을 하는
                  버튼인지 동사로 적는다.

                  답을 다 한 뒤에도 남긴다. 무엇을 답했는지 다시 보는 길이
                  없으면 대화가 사라진 것처럼 보인다. */}
              {railQuestions.length > 0 ? (
                <button
                  className="button secondary"
                  type="button"
                  aria-expanded={railOpen}
                  onClick={() => setRailChoice(!railOpen)}
                >
                  <SteadyLabel states={railToggleLabels} value={railToggleLabel} />
                </button>
              ) : null}
              {/* 파괴적이지 않은 이동은 공유 다음. 삭제는 마지막. */}
              <Link className="button secondary" href="/repositories">{LABEL.create}</Link>
              <button
                className="button secondary"
                type="button"
                ref={deleteTriggerRef}
                onClick={() => setConfirmingDelete(true)}
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>
      {/*
        주소는 액션 행이 아니라 자기 줄에 둔다. 예전에는 배지·주소·버튼 두 개가
        통째로 액션 행에 끼어들어 형제를 359px 밀어냈고, 정작 주소는 260px에서
        잘려 끝이 보이지 않았다. 줄을 따로 주면 행이 안정되고 주소도 온전히 보인다.
      */}
      {share?.published ? (
        <div className="page-container share-row">
          {confirmingUnpublish ? (
            <span className="delete-confirm" role="status">
              <strong>이미 보낸 링크가 열리지 않게 돼요.</strong>
              <button
                className="button danger"
                type="button"
                ref={unpublishConfirmRef}
                aria-disabled={sharing}
                onClick={() => togglePublish(false)}
              >
                <SteadyLabel
                  states={["비공개로 바꿀게요", "처리 중…"]}
                  value={sharing ? "처리 중…" : "비공개로 바꿀게요"}
                />
              </button>
              <button
                className="text-link"
                type="button"
                aria-disabled={sharing}
                onClick={() => setConfirmingUnpublish(false)}
              >
                취소
              </button>
            </span>
          ) : (
            <>
              <em className="share-badge">공개 중</em>
              <span className="share-url">{share.url}</span>
              {/* 공개 해제는 이미 보낸 링크를 전부 죽인다. 받은 사람은 404만 보고
                  이유를 알 수 없다. 삭제와 같은 2단계 확인을 둔다. */}
              <button
                className="text-link"
                type="button"
                ref={unpublishTriggerRef}
                onClick={() => setConfirmingUnpublish(true)}
              >
                비공개로
              </button>
            </>
          )}
        </div>
      ) : null}
      {/*
        문서는 되묻기를 알지 못한다. 표시를 남길 프로젝트만 받고, 공개 페이지와
        갤러리는 그것도 넘기지 않으므로 남에게 보내는 링크에 질문이 새어 나갈
        통로가 없다.
      */}
      <PortfolioDocument
        content={content}
        markedProjectUrls={railOpen ? markedUrls : undefined}
      />
      {actionError ? (
        <div className="page-container">
          <p className="inline-error" role="alert">{actionError}</p>
        </div>
      ) : null}
      <div className="page-container result-footer-actions">
        <Link className="text-link" href="/dashboard">← {LABEL.dashboard}로 돌아가기</Link>
        <p>인쇄 화면에서 “PDF로 저장”을 고르면 A4 포트폴리오로 남길 수 있어요.</p>
      </div>
      </div>
      <FollowUpRail
        portfolioId={portfolio.id}
        questions={railQuestions}
        projects={railProjects}
        open={railOpen}
        onClose={() => setRailChoice(false)}
        onApplied={applyResult}
      />
    </div>
  );
}
