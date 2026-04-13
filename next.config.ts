import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Custom `server.ts` runs Next + Socket.IO on one port; standalone bundle targets the default server only.
  experimental: {
    serverActions: {
      // 기본 1MB — FormData·Server Action 업로드가 여기서 먼저 막힘. 앱별 maxBytes와 별개로 상한을 넉넉히 둠.
      bodySizeLimit: "1gb",
    },
  },
};

export default nextConfig;
