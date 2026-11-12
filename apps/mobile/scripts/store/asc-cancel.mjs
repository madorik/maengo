// App Store 심사 대기 중인 제출을 뺀다(이름·부제·스크린샷을 고치려고). node asc-cancel.mjs
// 뺀 버전은 DEVELOPER_REJECTED가 되고 upload.mjs로 고친 뒤 asc-submit.mjs로 다시 낸다(2026-11-12)
import { asc, APP_ID } from "./stores.mjs";

const subs = (await asc("GET", `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&filter[state]=WAITING_FOR_REVIEW,IN_REVIEW`)).data;
if (!subs.length) console.log("심사 대기 중인 제출 없음");
for (const s of subs) {
  if (s.attributes.state === "IN_REVIEW") {
    console.log("심사 중이라 빼지 않음", s.id);
    continue;
  }
  const r = await asc("PATCH", `/v1/reviewSubmissions/${s.id}`, { data: { type: "reviewSubmissions", id: s.id, attributes: { canceled: true } } });
  console.log("canceled", s.id, r?.data?.attributes?.state);
}
