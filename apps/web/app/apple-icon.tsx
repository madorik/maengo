import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// 홈 화면 아이콘(PNG). 원본은 app/icon.svg(앱 아이콘 B안 "망고 가득").
// iOS가 모서리를 직접 깎으므로 둥근 모서리 없이 꽉 채운다.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const svg = (await readFile(join(process.cwd(), "app/icon.svg"), "utf8")).replace('rx="45" ', "");
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    <img src={src} width={180} height={180} alt="" />,
    size,
  );
}
