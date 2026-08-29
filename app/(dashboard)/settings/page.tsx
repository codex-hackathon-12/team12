"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GitHubConnectionDto } from "@/contracts/api-contract";
import { apiClient } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));

export default function SettingsPage() {
  const [connection, setConnection] = useState<GitHubConnectionDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .getConnection()
      .then((data) => {
        if (active) setConnection(data);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadFailed) {
    return (
      <div className="page-container settings-page">
        <p className="settings-empty" role="alert">
          GitHub 연동 정보를 불러오지 못했어요. 잠시 후 다시 열어주세요.
        </p>
      </div>
    );
  }

  if (!connection) return <LoadingState label="연동 정보를 불러오고 있어요" />;

  /* 재요청은 로그인과 같은 경로를 탄다. 이미 승인한 스코프만 요청하면 GitHub이
     동의 화면 없이 그대로 통과시키므로, 조직 접근을 새로 받았을 때 토큰을
     최신화하는 용도로 쓰인다. */
  const reauthorizeHref = apiClient.getGitHubLoginUrl("/settings");

  return (
    <div className="page-container settings-page">
      <section className="settings-section">
        <div className="section-title-row compact-title">
          <div>
            <p className="eyebrow">CONNECTED ACCOUNT</p>
            <h2>GitHub 연동</h2>
          </div>
        </div>

        <div className="connection-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="connection-avatar"
            src={connection.avatarUrl}
            alt=""
            width={56}
            height={56}
          />
          <div className="connection-identity">
            <strong>{connection.username}</strong>
            <span>{formatDate(connection.connectedAt)}부터 연동됨</span>
          </div>
          <Link className="text-link" href={connection.profileUrl} target="_blank" rel="noreferrer">
            GitHub 프로필 열기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title-row compact-title">
          <div>
            <p className="eyebrow">PERMISSIONS</p>
            <h2>부여된 권한</h2>
          </div>
          <span>{connection.scopes.filter((scope) => scope.granted).length}/{connection.scopes.length}</span>
        </div>

        {connection.needsReauthorization ? (
          <p className="settings-notice" role="status">
            빠진 권한이 있어요. 아래에서 다시 연동하면 GitHub이 부족한 권한만 물어봅니다.
          </p>
        ) : null}

        <ul className="scope-list">
          {connection.scopes.map((scope) => (
            <li className={scope.granted ? "scope-row granted" : "scope-row"} key={scope.name}>
              <span className="scope-state" aria-hidden="true">
                {scope.granted ? "✓" : "!"}
              </span>
              <div>
                <strong>
                  {scope.label}
                  {scope.required ? <em className="scope-required">필수</em> : null}
                </strong>
                <p>{scope.description}</p>
                <code className="mono-label">{scope.name}</code>
              </div>
              <span className="scope-status">{scope.granted ? "허용됨" : "허용 안 됨"}</span>
            </li>
          ))}
        </ul>

        {connection.extraScopes.length > 0 ? (
          <p className="settings-hint">
            이전 연동에서 남은 권한: {connection.extraScopes.join(", ")}
          </p>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="section-title-row compact-title">
          <div>
            <p className="eyebrow">MANAGE ACCESS</p>
            <h2>권한 다시 요청 · 조직 접근</h2>
          </div>
        </div>

        <div className="settings-action-grid">
          <div className="settings-action">
            <strong>GitHub 다시 연동하기</strong>
            <p>
              권한을 새로 받거나 토큰을 갱신합니다. 이미 승인한 권한만 필요하면 GitHub이
              동의 화면 없이 바로 돌아옵니다.
            </p>
            <Link className="button primary" href={reauthorizeHref}>
              <span className="github-glyph" aria-hidden="true">GH</span>
              다시 연동하기
            </Link>
          </div>

          <div className="settings-action">
            <strong>조직 저장소 접근 관리</strong>
            <p>
              조직 저장소는 조직의 승인이 있어야 보입니다. 승인 요청과 권한 취소는 GitHub
              설정에서만 할 수 있어요. 승인받은 뒤 여기로 돌아와 다시 연동해주세요.
            </p>
            <Link
              className="button secondary"
              href={connection.manageUrl}
              target="_blank"
              rel="noreferrer"
            >
              GitHub 설정 열기 <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
