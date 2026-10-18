// 앱 빌드 올리기(Play). node release.mjs <aab | 버전 코드> [트랙=internal] [출시 메모]
// AAB를 올리고 트랙에 새 출시를 만든다. 이미 올린 빌드를 다른 트랙(예: 내부 → 비공개 테스트 alpha)에 낼 때는 AAB 대신 버전 코드를 준다.
// 앱이 아직 한 번도 공개되지 않았으면 Play가 'draft' 출시만 받으므로 그때는 초안으로 만든다.
// iOS 빌드는 xcodebuild -exportArchive(destination upload)로 올리고, 처리 상태는 node release.mjs --ios 로 본다.
import { readFileSync } from "node:fs";
import { asc, APP_ID, play } from "./stores.mjs";

const [build, track = "internal", notes = ""] = process.argv.slice(2);
const isCode = /^\d+$/.test(build ?? "");

/** 새 edit에 번들을 올리고(버전 코드면 건너뜀) 트랙 출시를 넣어 커밋한다 */
async function commit(status) {
  const edit = await play("POST", "/edits", {});
  const e = `/edits/${edit.id}`;
  let code = build;
  if (!isCode) {
    const bundle = await play("POST", `${e}/bundles`, readFileSync(build), { upload: true, contentType: "application/octet-stream" });
    console.log("Play bundle", bundle.versionCode, bundle.sha256);
    code = String(bundle.versionCode);
  }
  await play("PUT", `${e}/tracks/${track}`, {
    track,
    releases: [{ versionCodes: [code], status, ...(notes ? { releaseNotes: [{ language: "ko-KR", text: notes }] } : {}) }],
  });
  const done = await play("POST", `${e}:commit`);
  console.log("Play", track, code, status, "commit", done.id);
}

async function releasePlay() {
  try {
    await commit("completed");
  } catch (err) {
    if (!/draft/i.test(String(err))) throw err;
    await commit("draft");
  }
}

async function iosBuilds() {
  const b = await asc("GET", `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5&fields[builds]=version,uploadedDate,processingState,expired`);
  for (const x of b.data) console.log("iOS build", x.attributes.version, x.attributes.processingState, x.attributes.uploadedDate);
}

if (build === "--ios") await iosBuilds();
else await releasePlay();
