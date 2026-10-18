// 앱 빌드 올리기(Play). node release.mjs <aab> [트랙=internal] [출시 메모]
// AAB를 올리고 트랙에 새 출시를 만든다. 앱이 아직 한 번도 공개되지 않았으면 Play가 'draft' 출시만 받으므로 그때는 초안으로 만든다.
// iOS 빌드는 xcodebuild -exportArchive(destination upload)로 올리고, 처리 상태는 node release.mjs --ios 로 본다.
import { readFileSync } from "node:fs";
import { asc, APP_ID, play } from "./stores.mjs";

const [aab, track = "internal", notes = ""] = process.argv.slice(2);

async function releasePlay() {
  const edit = await play("POST", "/edits", {});
  const e = `/edits/${edit.id}`;
  const bundle = await play("POST", `${e}/bundles`, readFileSync(aab), { upload: true, contentType: "application/octet-stream" });
  console.log("Play bundle", bundle.versionCode, bundle.sha256);
  const release = (status) => ({
    track,
    releases: [{ versionCodes: [String(bundle.versionCode)], status, ...(notes ? { releaseNotes: [{ language: "ko-KR", text: notes }] } : {}) }],
  });
  try {
    await play("PUT", `${e}/tracks/${track}`, release("completed"));
    const done = await play("POST", `${e}:commit`);
    console.log("Play", track, "completed, commit", done.id);
  } catch (err) {
    if (!/draft/i.test(String(err))) throw err;
    // 커밋이 실패하면 edit이 지워지므로 새로 만든다
    const edit2 = await play("POST", "/edits", {});
    const e2 = `/edits/${edit2.id}`;
    const b2 = await play("POST", `${e2}/bundles`, readFileSync(aab), { upload: true, contentType: "application/octet-stream" }).catch(() => null);
    if (!b2) console.log("(같은 번들은 이미 올라가 있음)");
    await play("PUT", `${e2}/tracks/${track}`, release("draft"));
    const done = await play("POST", `${e2}:commit`);
    console.log("Play", track, "draft(앱이 아직 공개 전), commit", done.id);
  }
}

async function iosBuilds() {
  const b = await asc("GET", `/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5&fields[builds]=version,uploadedDate,processingState,expired`);
  for (const x of b.data) console.log("iOS build", x.attributes.version, x.attributes.processingState, x.attributes.uploadedDate);
}

if (aab === "--ios") await iosBuilds();
else await releasePlay();
