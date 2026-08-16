"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { AnnouncementDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

export default function AnnouncementPage() {
  const params = useParams<{ announcementId: string }>();
  const [announcement, setAnnouncement] = useState<AnnouncementDto | null>(null);

  useEffect(() => {
    apiClient.getAnnouncement(String(params.announcementId)).then(setAnnouncement);
  }, [params.announcementId]);

  if (!announcement) return <LoadingState label="새로운 소식을 불러오고 있어요" />;

  return (
    <main className="announcement-page">
      <article>
        <Link className="text-link" href="/dashboard">← 대시보드로 돌아가기</Link>
        <div className="announcement-meta">
          <span>{announcement.type === "event" ? "EVENT" : "NOTICE"}</span>
          <time>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" }).format(new Date(announcement.publishedAt))}</time>
        </div>
        <h1>{announcement.title}</h1>
        <p className="announcement-summary">{announcement.summary}</p>
        <div className="announcement-content"><p>{announcement.content}</p></div>
        <Link className="button primary" href="/repositories">포트폴리오 만들기</Link>
      </article>
    </main>
  );
}
