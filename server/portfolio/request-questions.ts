import {
  PORTFOLIO_HIGHLIGHT_SLOTS,
  type PortfolioProjectDto,
  type PortfolioQuestionDto,
  type PortfolioQuestionSlot,
} from "@/contracts/api-contract";
import { getPortfolio } from "@/server/portfolio/portfolios";
import { buildRequestedQuestions } from "@/server/portfolio/questions";
import { insertPortfolioQuestions, listPortfolioQuestions } from "@/server/portfolio/statements";

/**
 * 지원자가 직접 빈 자리를 연다.
 *
 * 되묻기 질문은 포트폴리오를 만들 때 초안과 함께 한 번 생긴다. 결정 질문은
 * 세 조각이 같은 topic으로 다 와야 살아남으므로, 모델이 어떤 저장소에 대해
 * 묶음을 내지 않으면 그 프로젝트의 핵심 결정은 영영 빈 채로 남았다. 생성
 * 지침은 "비워두면 나중에 지원자에게 직접 물어볼 수 있다"고 적어놓았는데,
 * 물어볼 통로가 그 모델 호출 안에만 있었다.
 *
 * 모델을 부르지 않고 생성 근거도 읽지 않는다. 그래서 즉시 열리고, 크레딧을
 * 쓰지 않으며, 근거가 남아 있지 않은 오래된 포트폴리오에서도 된다. 답을
 * 반영하는 일은 여전히 근거가 필요하지만, 질문을 여는 일은 아니다.
 */

export type RequestFailure =
  | { kind: "notFound" }
  | { kind: "alreadyFilled" };

/**
 * 그 자리가 실제로 비어 있는지 본다.
 *
 * 채워진 자리를 열어주면 지원자가 성심껏 답해도 병합 단계가 버려 아무것도
 * 바뀌지 않는다. 답을 다 쓴 뒤에야 드러나는 실패라 여기서 막는다 —
 * 질문 선별의 `isOpenSlot`이 하던 것과 같은 판단이다.
 */
export function isOpenSlot(slot: PortfolioQuestionSlot, project: PortfolioProjectDto): boolean {
  return slot === "keyDecision"
    ? project.keyDecision.headline.trim().length === 0
    : project.highlights.length < PORTFOLIO_HIGHLIGHT_SLOTS;
}

export async function requestPortfolioQuestions(
  userId: string,
  portfolioId: string,
  repositoryName: string,
  slot: PortfolioQuestionSlot,
): Promise<PortfolioQuestionDto[] | RequestFailure> {
  /* 소유자 조건이 걸린 조회다. 저장소 목록과 문서를 함께 주므로 이름과
     프로젝트를 잇는 데 따로 질의할 것이 없다. */
  const portfolio = await getPortfolio(userId, portfolioId);
  if (!portfolio) return { kind: "notFound" };

  /* 문서의 프로젝트에는 저장소 이름이 없다. 화면에 필요한 것만 담아
     repositoryUrl만 남기기 때문이다. 저장소 목록을 거쳐 잇는다. */
  const repository = portfolio.repositories.find((item) => item.name === repositoryName);
  const project = repository
    ? portfolio.content.projects.find((item) => item.repositoryUrl === repository.htmlUrl)
    : undefined;
  if (!project) return { kind: "notFound" };

  if (!isOpenSlot(slot, project)) return { kind: "alreadyFilled" };

  /* 같은 자리를 두 번 눌러도 안전하다. `(portfolio_id, repository_name,
     field)` 유니크 인덱스가 있고 삽입이 중복을 무시하므로, 이미 있는 질문은
     답까지 그대로 남는다. */
  await insertPortfolioQuestions(
    userId,
    portfolioId,
    buildRequestedQuestions(slot, repositoryName, project.title),
  );

  return listPortfolioQuestions(portfolioId);
}
