import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/core는 빌드 없이 TS 소스를 그대로 내보낸다.
  transpilePackages: ["@maengo/core"],
  // 유튜브 썸네일
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }] },
  // 아이콘·manifest는 기본값(max-age=0)이면 화면을 옮길 때마다 서버에 다시 확인한다.
  // 아이콘 주소에는 내용 해시가 붙어(?icon.<hash>.svg) 바뀌면 주소도 바뀌므로 오래 둔다. manifest는 하루.
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/icon.svg", headers: immutable },
      { source: "/apple-icon", headers: immutable },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
};

export default nextConfig;
