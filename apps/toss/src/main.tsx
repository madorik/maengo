import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource-variable/nunito";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { openExternal } from "./bridge";
import { tossPlayer } from "./shims/player";

// 원문 링크 같은 바깥 주소는 토스 화면 안에서 열지 않고 기기 브라우저로 연다(앱인토스 정책).
// 오늘의 흐름의 묶인 소식(/article/toss-<번호>)은 그 소식부터 듣는다. 그 밖의 안쪽 주소는 열지 않는다(토스판은 화면이 하나)
document.addEventListener("click", (e) => {
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute("href") ?? "";
  e.preventDefault();
  if (/^https?:\/\//.test(href)) void openExternal(href);
  const toss = href.match(/\/article\/toss-(\d+)/);
  if (toss) tossPlayer.playId(Number(toss[1]));
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
