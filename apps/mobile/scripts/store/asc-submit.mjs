// App Store 심사 제출: 제출 준비 중인 버전에 빌드를 붙이고 심사에 낸다. node asc-submit.mjs <버전> <빌드 번호>
// 암호화 질문(usesNonExemptEncryption)이 비어 있으면 '아니요'(HTTPS만 쓴다)로 채운다
import { asc, APP_ID } from "./stores.mjs";
const [versionString, buildNumber] = process.argv.slice(2);

const v = (await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${versionString}`)).data[0];
if (!v) throw new Error(`버전 ${versionString} 없음`);
console.log("version", v.id, v.attributes.appStoreState);
const b = (await asc("GET", `/v1/builds?filter[app]=${APP_ID}&filter[version]=${buildNumber}&fields[builds]=version,processingState,usesNonExemptEncryption`)).data[0];
if (!b || b.attributes.processingState !== "VALID") throw new Error(`빌드 ${buildNumber} 처리 전: ${b?.attributes.processingState}`);
if (b.attributes.usesNonExemptEncryption == null) {
  await asc("PATCH", `/v1/builds/${b.id}`, { data: { type: "builds", id: b.id, attributes: { usesNonExemptEncryption: false } } });
  console.log("encryption: false");
}
await asc("PATCH", `/v1/appStoreVersions/${v.id}/relationships/build`, { data: { type: "builds", id: b.id } });
console.log("build attached", buildNumber);

// 열려 있는 제출 묶음이 있으면 그것을, 없으면 새로
const open = (await asc("GET", `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW`)).data[0];
const sub =
  open ??
  (
    await asc("POST", "/v1/reviewSubmissions", {
      data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP_ID } } } },
    })
  ).data;
await asc("POST", "/v1/reviewSubmissionItems", {
  data: {
    type: "reviewSubmissionItems",
    relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub.id } }, appStoreVersion: { data: { type: "appStoreVersions", id: v.id } } },
  },
});
const done = await asc("PATCH", `/v1/reviewSubmissions/${sub.id}`, { data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } } });
console.log("submitted", sub.id, done?.data?.attributes?.state);
