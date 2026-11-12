import { defineConfig } from "@apps-in-toss/web-framework/config";

// 맹고 토스 미니앱(intoss://maengo). 맹고-문서/앱인토스-검토.md
export default defineConfig({
  appName: "maengo",
  permissions: [],
  // 토스 네비게이션 바의 뒤로가기만 쓴다(앱 안에 따로 두지 않는다). 누르면 src/bridge.ts onBack이 받는다
  navigationBar: { withBackButton: true },
  webView: {
    // 듣기는 사용자가 누를 때만 시작한다
    mediaPlaybackRequiresUserAction: true,
    allowsInlineMediaPlayback: true,
    overScrollMode: "never",
  },
  webBundleDir: "dist",
});
