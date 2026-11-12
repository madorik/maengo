import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource-variable/nunito";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { openExternal } from "./bridge";

// 원문 링크 같은 바깥 주소는 토스 화면 안에서 열지 않고 기기 브라우저로 연다(앱인토스 정책)
document.addEventListener("click", (e) => {
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute("href") ?? "";
  e.preventDefault();
  if (/^https?:\/\//.test(href)) void openExternal(href);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
