// App Store Connect에 새 버전(제출 준비 중)을 만든다. node asc-version.mjs <버전> <새 기능 문구>
import { asc, APP_ID } from "./stores.mjs";
const [versionString, whatsNew] = process.argv.slice(2);
const list = await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=5`);
let v = list.data.find((x) => x.attributes.versionString === versionString);
if (!v) {
  v = (await asc("POST", "/v1/appStoreVersions", {
    data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString, releaseType: "AFTER_APPROVAL" }, relationships: { app: { data: { type: "apps", id: APP_ID } } } },
  })).data;
  console.log("created", v.id, versionString);
} else console.log("exists", v.id, v.attributes.appStoreState);
const loc = (await asc("GET", `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === "ko");
await asc("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew } } });
console.log("whatsNew set");
