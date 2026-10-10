import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// 링크를 공유할 때 보이는 카드 이미지(1200×630). 빌드 때 한 번 만든다.
// 한글을 그리려면 글꼴이 필요해서 Pretendard OTF를 직접 넣는다.
export const alt = "맹고 - 관심 분야 소식을 매일 아침 요약하고 읽어 드려요";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const fonts = join(process.cwd(), "node_modules/pretendard/dist/public/static");
  const [black, bold, icon] = await Promise.all([
    readFile(join(fonts, "Pretendard-Black.otf")),
    readFile(join(fonts, "Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "app/icon.svg"), "utf8"),
  ]);
  const iconSrc = `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 56, padding: "64px 80px", background: "#FFF4D6", fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#A86A00", letterSpacing: -1.5 }}>맹고</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 80, fontWeight: 900, color: "#1F2340", lineHeight: 1.15, letterSpacing: -3 }}>
            <span>검색은 AI가,</span>
            <span>당신은 듣기만.</span>
          </div>
          {/* 한글은 글자 단위로 줄이 바뀌어서 두 줄로 직접 나눈다 */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30, fontSize: 34, fontWeight: 700, color: "#545A70", lineHeight: 1.4 }}>
            <span>관심 분야 소식을</span>
            <span>매일 아침 요약하고 읽어 드려요</span>
          </div>
        </div>
        <img src={iconSrc} width={340} height={340} alt="" style={{ borderRadius: 76, boxShadow: "0 16px 0 #E09A12" }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: black, weight: 900, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
