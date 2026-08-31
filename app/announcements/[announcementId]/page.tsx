"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatLongDay } from "@/lib/format";
import { LoadingState } from "@/components/ui/LoadingState";

export default function AnnouncementPage() {
  const params = useParams<{ announcementId: string }>();
  const announcementId = String(params.announcementId);
  const { data: announcement, error: loadError, reload } = useAsyncData(
    () => apiClient.getAnnouncement(announcementId),
    [announcementId],
    "소식을 불러오지 못했어요.",
  );

  if (loadError) {
    return (
      <main className="announcement-page">
        <article>
          <p className="inline-error" role="alert">
            {loadError}
            <button type="button" onClick={reload}>다시 불러오기</button>
          </p>
          <Link className="text-link" href="/dashboard">← 대시보드로 돌아가기</Link>
        </article>
      </main>
    );
  }

  if (!announcement) return <LoadingState label="새로운 소식을 불러오고 있어요" />;

  return (
    <main className="announcement-page">
      <article>
        <Link className="text-link" href="/dashboard">← 대시보드로 돌아가기</Link>
        <div className="announcement-meta">
          <span>{announcement.type === "event" ? "EVENT" : "NOTICE"}</span>
          <time>{formatLongDay(announcement.publishedAt)}</time>
        </div>
        <h1>{announcement.title}</h1>
        <p className="announcement-summary">{announcement.summary}</p>
        <div className="announcement-content"><p>{announcement.content}</p></div>
        <Link className="button primary" href="/repositories">포트폴리오 만들기</Link>
      </article>
    </main>
  );
}
