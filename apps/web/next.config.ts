import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/core는 빌드 없이 TS 소스를 그대로 내보낸다.
  transpilePackages: ["@maengo/core"],
  // 유튜브 썸네일
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }] },
};

export default nextConfig;
