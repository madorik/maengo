import type { CapacitorConfig } from "@capacitor/cli";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// 앱은 배포된 웹을 띄운다(APP_PLAN.md 3장). 개발 때는 CAP_SERVER_URL=http://<맥 LAN IP>:3100 으로 로컬 서버를 띄운다.
// 이 값은 `cap sync`/`cap copy` 때 네이티브 프로젝트에 들어가므로, 바꾸면 다시 sync한다. cap 명령은 이 폴더에서 실행한다.
const serverUrl = (process.env.CAP_SERVER_URL || "https://maengo.vercel.app").replace(/\/+$/, "");
const { version } = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { version: string };

// 웹을 못 불러올 때 뜨는 안내 화면. "다시 시도"로 돌아갈 주소를 넣어 www/index.html로 만든다(www는 gitignore).
// 안드로이드의 안내 화면에는 Capacitor가 주입되지 않고 같은 폴더의 다른 파일도 못 읽어서 HTML에 직접 넣는다.
mkdirSync(resolve("www"), { recursive: true });
writeFileSync(resolve("www/index.html"), readFileSync(resolve("offline.html"), "utf8").replace("__SERVER_URL__", JSON.stringify(serverUrl)));

const config: CapacitorConfig = {
  appId: "kr.maengo.app",
  appName: "맹고",
  webDir: "www",
  backgroundColor: "#FFFFFF",
  server: {
    url: serverUrl,
    // 개발 서버(http)만. sync 때 생성되는 매니페스트에만 들어가고 운영 URL로 다시 sync하면 빠진다
    cleartext: serverUrl.startsWith("http:"),
    // 연결이 없거나(양쪽) 첫 화면이 HTTP 오류일 때(안드로이드) 띄운다
    errorPath: "index.html",
  },
  // 웹이 앱 요청을 알아보는 표시(apps/web/lib/app-client.ts)
  ios: { appendUserAgent: `MaengoApp/${version} (ios)` },
  android: { appendUserAgent: `MaengoApp/${version} (android)` },
  plugins: {
    // 웹은 이미 viewport-fit=cover + env(safe-area-inset-*)를 쓴다. native는 그 값을 맞게 채워 준다(옛 웹뷰는 여백으로 대신)
    SystemBars: { insetsHandling: "native", initialViewportFitValueHint: "cover", style: "LIGHT" },
    // 웹이 화면에 붙으면 바로 숨긴다(apps/web/lib/native/shell.ts). 웹을 못 불러와도 3초 뒤엔 숨는다
    SplashScreen: { launchShowDuration: 3000, launchAutoHide: true, launchFadeOutDuration: 200, backgroundColor: "#FFC23D", showSpinner: false },
  },
};

export default config;
