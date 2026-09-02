import type {
  AnnouncementDto,
  AnnouncementSummaryDto,
  GalleryExampleDto,
  GalleryExampleSummaryDto,
  TasteSampleDto,
} from "@/contracts/api-contract";
import { MOCK_NOTE } from "@/lib/copy";
import { PUBLIC_THUMBNAIL_URL } from "@/server/content/links";
import {
  createPortfolioContent,
  type GalleryExampleInput,
} from "@/server/content/portfolio-samples";

type ContentPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

type GalleryListOptions = {
  role?: string;
  techStack?: string;
  offset: number;
  limit: number;
};

type AnnouncementListOptions = {
  offset: number;
  limit: number;
};


function createGalleryExample(input: GalleryExampleInput): GalleryExampleDto {
  return {
    id: input.id,
    title: input.title,
    targetRole: input.targetRole,
    description: input.description,
    thumbnailUrl: PUBLIC_THUMBNAIL_URL,
    techStack: [...input.techStack],
    style: "default",
    createdAt: input.createdAt,
    portfolio: createPortfolioContent(input),
  };
}

const galleryExamples: GalleryExampleDto[] = [
  createGalleryExample({
    id: "gallery_backend",
    title: "근거가 선명한 백엔드 포트폴리오",
    targetRole: "Backend Engineer",
    description: "API 설계와 데이터 흐름을 중심으로 구성한 공개 예시예요.",
    techStack: ["TypeScript", "Next.js", "PostgreSQL"],
    createdAt: "2026-08-16T04:00:00.000Z",
  }),
  createGalleryExample({
    id: "gallery_frontend",
    title: "경험을 흐름으로 보여주는 프론트엔드 포트폴리오",
    targetRole: "Frontend Engineer",
    description: "사용자 경험과 화면 상태 설계를 한 흐름으로 보여주는 공개 예시예요.",
    techStack: ["React", "TypeScript", "CSS"],
    createdAt: "2026-08-15T04:00:00.000Z",
  }),
  createGalleryExample({
    id: "gallery_product",
    title: "제품 감각을 담은 풀스택 포트폴리오",
    targetRole: "Product Engineer",
    description: "문제 발견부터 제품 구현까지의 판단을 정리한 공개 예시예요.",
    techStack: ["Next.js", "Node.js", "PostgreSQL"],
    createdAt: "2026-08-14T04:00:00.000Z",
  }),
  createGalleryExample({
    id: "gallery_mobile",
    title: "디테일이 살아있는 모바일 포트폴리오",
    targetRole: "Android Engineer",
    description: "모바일 사용성과 앱 구조를 중심으로 정리한 공개 예시예요.",
    techStack: ["Kotlin", "Compose", "Room"],
    createdAt: "2026-08-13T04:00:00.000Z",
  }),
  createGalleryExample({
    id: "gallery_data",
    title: "실험과 지표 중심 데이터 포트폴리오",
    targetRole: "Data Analyst",
    description: "분석 질문과 결과 해석을 분명하게 보여주는 공개 예시예요.",
    techStack: ["Python", "SQL", "Tableau"],
    createdAt: "2026-08-12T04:00:00.000Z",
  }),
  createGalleryExample({
    id: "gallery_design",
    title: "개발 언어로 설명하는 UX 엔지니어 포트폴리오",
    targetRole: "UX Engineer",
    description: "디자인 시스템과 구현 협업을 연결한 공개 예시예요.",
    techStack: ["Figma", "React", "Storybook"],
    createdAt: "2026-08-11T04:00:00.000Z",
  }),
];

const announcements: AnnouncementDto[] = [
  {
    id: "announcement_mvp_launch",
    type: "event",
    title: "MVP 오픈 기념, 첫 포트폴리오 생성 체험",
    summary: "준비된 맛보기와 공개 예시를 먼저 확인해보세요.",
    content: "지금은 준비된 맛보기와 공개 갤러리로 포트폴리오가 어떻게 구성되는지 볼 수 있어요.",
    publishedAt: "2026-08-16T00:00:00.000Z",
    endsAt: "2026-08-31T14:59:59.000Z",
    isPinned: true,
  },
  {
    id: "announcement_mock_credits",
    type: "notice",
    title: "크레딧과 결제는 아직 체험이에요",
    summary: "표시되는 크레딧과 상품은 흐름을 확인하기 위한 체험 데이터예요.",
    content: `${MOCK_NOTE} 표시되는 크레딧과 결제 상품은 흐름을 확인하기 위한 체험 데이터라, 실제 승인도 일어나지 않아요.`,
    publishedAt: "2026-08-14T02:00:00.000Z",
    endsAt: null,
    isPinned: false,
  },
  {
    id: "announcement_portfolio_guidance",
    type: "notice",
    title: "포트폴리오에는 확인 가능한 경험을 담아주세요",
    summary: "저장소 기록과 README에 근거한 내용을 중심으로 만들어요.",
    content: "생성 결과는 저장소의 공개 정보와 직접 적어주신 선호를 바탕으로 해요. 확인되지 않은 수치나 역할은 넣지 않는 편이 좋아요.",
    publishedAt: "2026-08-10T02:00:00.000Z",
    endsAt: null,
    isPinned: false,
  },
];

const tasteSample: TasteSampleDto = {
  id: "sample_backend",
  title: "백엔드 개발자 포트폴리오 예시",
  description: "준비된 저장소와 결과로 미리 보는 맛보기예요.",
  repository: {
    id: "sample_repo",
    name: "sample-api",
    fullName: "folio-ai/sample-api",
    description: "REST API 중심의 공개 포트폴리오 예시 프로젝트",
    primaryLanguage: "TypeScript",
  },
  prompt: "백엔드 직무에 맞춰 API 설계 경험을 강조해줘.",
  portfolioPreview: createPortfolioContent({
    id: "sample_backend",
    title: "API 중심 백엔드 포트폴리오",
    targetRole: "Backend Engineer",
    description: "정적 맛보기용 백엔드 포트폴리오 예시예요.",
    techStack: ["TypeScript", "Next.js", "PostgreSQL"],
    createdAt: "2026-08-16T04:00:00.000Z",
  }),
  isStatic: true,
};

function toAnnouncementSummary(announcement: AnnouncementDto): AnnouncementSummaryDto {
  return {
    id: announcement.id,
    type: announcement.type,
    title: announcement.title,
    summary: announcement.summary,
    publishedAt: announcement.publishedAt,
    endsAt: announcement.endsAt,
    isPinned: announcement.isPinned,
  };
}

function toGallerySummary(example: GalleryExampleDto): GalleryExampleSummaryDto {
  return {
    id: example.id,
    title: example.title,
    targetRole: example.targetRole,
    description: example.description,
    thumbnailUrl: example.thumbnailUrl,
    techStack: [...example.techStack],
    style: example.style,
    createdAt: example.createdAt,
  };
}

function createContentPage<TItem>(items: TItem[], offset: number, limit: number): ContentPage<TItem> {
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length < items.length ? offset + pageItems.length : null;

  return {
    items: pageItems,
    nextCursor: encodeContentCursor(nextOffset),
    hasNextPage: nextOffset !== null,
  };
}

function normalizeFilter(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

export function encodeContentCursor(offset: number | null): string | null {
  return offset === null ? null : btoa(String(offset));
}

export function decodeContentCursor(value: string | null): number | null {
  if (!value) {
    return 0;
  }

  try {
    const decoded = atob(value);
    if (!/^(0|[1-9]\d*)$/u.test(decoded)) {
      return null;
    }

    const offset = Number(decoded);
    return Number.isSafeInteger(offset) ? offset : null;
  } catch {
    return null;
  }
}

export function getTasteSample(): TasteSampleDto {
  return tasteSample;
}

export function listRecentAnnouncements(limit: number): AnnouncementSummaryDto[] {
  return announcements.slice(0, Math.max(0, limit)).map(toAnnouncementSummary);
}

export function listGalleryExamples(options: GalleryListOptions): ContentPage<GalleryExampleSummaryDto> {
  const role = normalizeFilter(options.role);
  const techStack = normalizeFilter(options.techStack);
  const filteredExamples = galleryExamples.filter((example) => {
    const roleMatches = !role || example.targetRole.toLowerCase() === role;
    const techStackMatches = !techStack || example.techStack.some((technology) => technology.toLowerCase() === techStack);
    return roleMatches && techStackMatches;
  });

  return createContentPage(filteredExamples.map(toGallerySummary), options.offset, options.limit);
}

export function getGalleryExample(exampleId: string): GalleryExampleDto | null {
  return galleryExamples.find((example) => example.id === exampleId) ?? null;
}

export function listAnnouncements(options: AnnouncementListOptions): ContentPage<AnnouncementSummaryDto> {
  return createContentPage(announcements.map(toAnnouncementSummary), options.offset, options.limit);
}

export function getAnnouncement(announcementId: string): AnnouncementDto | null {
  return announcements.find((announcement) => announcement.id === announcementId) ?? null;
}
