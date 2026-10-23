import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORY_LABEL } from "@maengo/core/categories";
import { ImageResponse } from "next/og";
import { sharedItem } from "@/lib/server/shared-item";

// 공유한 소식의 카드 이미지(1200×630). 카카오톡·메신저 미리보기에 제목이 바로 보이게 소식 제목을 크게 넣는다.
// 글꼴·색은 맹고 기본 카드 이미지(app/opengraph-image.tsx)와 같다. 없는 소식이면 맹고 소개 문구로 그린다.
export const alt = "맹고에서 요약한 소식";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

/** 제목이 길면 세 줄 안에 들도록 글자 크기를 줄이고, 그래도 넘치면 자른다 */
function fit(title: string): { text: string; fontSize: number } {
  const n = [...title].length;
  if (n <= 26) return { text: title, fontSize: 68 };
  if (n <= 40) return { text: title, fontSize: 58 };
  const max = 54;
  return { text: n > max ? `${[...title].slice(0, max - 1).join("")}…` : title, fontSize: 50 };
}

export default async function SharedItemImage({ params }: { params: Promise<{ id: string }> }) {
  const item = await sharedItem(Number((await params).id));
  const fonts = join(process.cwd(), "node_modules/pretendard/dist/public/static");
  const [black, bold, icon] = await Promise.all([
    readFile(join(fonts, "Pretendard-Black.otf")),
    readFile(join(fonts, "Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "app/icon.svg"), "utf8"),
  ]);
  const iconSrc = `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`;
  const { text, fontSize } = fit(item?.title ?? "관심 분야 소식을 매일 아침 요약하고 읽어 드려요");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "60px 72px", background: "#FFF4D6", fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={iconSrc} width={72} height={72} alt="" style={{ borderRadius: 18 }} />
          <div style={{ fontSize: 40, fontWeight: 900, color: "#A86A00", letterSpacing: -1.5 }}>맹고</div>
          {item && (
            <div style={{ marginLeft: "auto", display: "flex", padding: "8px 22px", borderRadius: 999, background: "#FFFFFF", fontSize: 28, fontWeight: 700, color: "#545A70" }}>
              {CATEGORY_LABEL[item.category]} · {item.sourceLabel}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            fontSize,
            fontWeight: 900,
            color: "#1F2340",
            lineHeight: 1.3,
            letterSpacing: -2,
            wordBreak: "keep-all",
          }}
        >
          {text}
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#545A70" }}>맹고가 요약했어요 · 매일 아침 관심 분야 소식</div>
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
