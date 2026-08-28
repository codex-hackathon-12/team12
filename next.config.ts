import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  images: {
    // 포트폴리오 프로필 사진은 GitHub 아바타만 사용한다.
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/u/**" },
    ],
  },
};

export default withWorkflow(nextConfig);
