// 두 스토어에 설명·스크린샷 올리기. node upload.mjs <storeDir> <STORE.md> <icon512> [play|asc]
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { asc, APP_ID, play } from "./stores.mjs";

const [dir, storeMd, icon512, only] = process.argv.slice(2);
const md = readFileSync(storeMd, "utf8");
const section = (title) => {
  const start = md.indexOf(`### ${title}`);
  if (start < 0) throw new Error(`STORE.md에 "${title}" 없음`);
  const from = md.indexOf("\n", start) + 1;
  const next = md.slice(from).search(/\n#{2,3} /);
  return md.slice(from, next < 0 ? undefined : from + next).trim();
};
const SHORT = section("짧은 설명(Play, 80자 이내)");
const FULL = section("전체 설명(Play 전체 설명 / App Store 설명)");
const KEYWORDS = md.match(/\| 키워드\(App Store, 100자\) \| ([^|]+) \|/)[1].trim();
const fullFor = (store) => FULL.replace("App Store·Google Play의 구독 관리", `${store}의 구독 관리`);
if (fullFor("App Store").includes("Google Play") || fullFor("Google Play").includes("App Store·")) throw new Error("플랫폼 문구 치환 실패");
const shots = (prefix) => readdirSync(dir).filter((f) => f.startsWith(prefix)).sort().map((f) => join(dir, f));

async function uploadPlay() {
  const edit = await play("POST", "/edits", {});
  const e = `/edits/${edit.id}`;
  await play("PUT", `${e}/listings/ko-KR`, { language: "ko-KR", title: "맹고", shortDescription: SHORT, fullDescription: fullFor("Google Play") });
  await play("PATCH", `${e}/details`, { contactEmail: "watalabs.help@gmail.com", contactWebsite: "https://watalabs.com" });
  const put = async (type, files) => {
    await play("DELETE", `${e}/listings/ko-KR/${type}`);
    for (const f of files) {
      await play("POST", `${e}/listings/ko-KR/${type}`, readFileSync(f), { upload: true, contentType: "image/png" });
      console.log("Play", type, basename(f));
    }
  };
  await put("phoneScreenshots", shots("android-"));
  await put("featureGraphic", [join(dir, "play-feature-1024x500.png")]);
  await put("icon", [icon512]);
  const done = await play("POST", `${e}:commit`);
  console.log("Play commit", done.id);
}

async function uploadAsc() {
  const v = (await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION`)).data[0];
  const vloc = (await asc("GET", `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === "ko");
  await asc("PATCH", `/v1/appStoreVersionLocalizations/${vloc.id}`, {
    data: {
      type: "appStoreVersionLocalizations",
      id: vloc.id,
      attributes: {
        description: fullFor("App Store"),
        keywords: KEYWORDS,
        promotionalText: "관심 분야만 고르면, 이슈도가 높은 소식만 골라 요약하고 읽어 드려요. 영어 소식도 한국어로.",
        supportUrl: "https://watalabs.com",
        marketingUrl: "https://watalabs.com/maengo",
      },
    },
  });
  console.log("ASC version localization", v.attributes.versionString);

  const info = (await asc("GET", `/v1/apps/${APP_ID}/appInfos`)).data.find((i) => (i.attributes.appStoreState ?? i.attributes.state) !== "READY_FOR_SALE");
  const iloc = (await asc("GET", `/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find((l) => l.attributes.locale === "ko");
  await asc("PATCH", `/v1/appInfoLocalizations/${iloc.id}`, {
    data: { type: "appInfoLocalizations", id: iloc.id, attributes: { subtitle: "관심 분야 소식, 요약하고 읽어 드려요", privacyPolicyUrl: "https://watalabs.com/maengo/privacy" } },
  });
  console.log("ASC app info localization");

  // 6.7인치(1290×2796) 세트를 새로 채운다
  const sets = await asc("GET", `/v1/appStoreVersionLocalizations/${vloc.id}/appScreenshotSets`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === "APP_IPHONE_67");
  if (set) {
    const old = await asc("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`);
    for (const s of old.data) await asc("DELETE", `/v1/appScreenshots/${s.id}`);
  } else {
    set = (await asc("POST", "/v1/appScreenshotSets", {
      data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: "APP_IPHONE_67" }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: vloc.id } } } },
    })).data;
  }
  for (const f of shots("ios-")) {
    const bytes = readFileSync(f);
    const made = (await asc("POST", "/v1/appScreenshots", {
      data: { type: "appScreenshots", attributes: { fileName: basename(f), fileSize: statSync(f).size }, relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } },
    })).data;
    for (const op of made.attributes.uploadOperations) {
      const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error(`업로드 실패 ${basename(f)} ${r.status}`);
    }
    await asc("PATCH", `/v1/appScreenshots/${made.id}`, {
      data: { type: "appScreenshots", id: made.id, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") } },
    });
    console.log("ASC screenshot", basename(f));
  }
  // 처리 결과 확인
  await new Promise((r) => setTimeout(r, 8000));
  const after = await asc("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`);
  console.log("ASC states:", after.data.map((s) => `${s.attributes.fileName}:${s.attributes.assetDeliveryState?.state}`));
}

if (!only || only === "play") await uploadPlay();
if (!only || only === "asc") await uploadAsc();
