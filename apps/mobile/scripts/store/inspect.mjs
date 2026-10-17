// 읽기만: 두 스토어의 지금 등록 정보 상태
import { asc, APP_ID, play } from "./stores.mjs";

// App Store Connect
const versions = await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?fields[appStoreVersions]=versionString,appStoreState,platform&limit=10`);
console.log("ASC versions:", versions.data.map((v) => `${v.id} ${v.attributes.versionString} ${v.attributes.appStoreState}`));
for (const v of versions.data) {
  const locs = await asc("GET", `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`);
  for (const l of locs.data) {
    const a = l.attributes;
    console.log(`  loc ${l.id} ${a.locale} desc=${(a.description || "").length} kw=${(a.keywords || "").length} promo=${(a.promotionalText || "").length} support=${a.supportUrl} marketing=${a.marketingUrl}`);
    const sets = await asc("GET", `/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots`);
    console.log("    screenshot sets:", sets.data.map((s) => `${s.attributes.screenshotDisplayType}(${s.relationships.appScreenshots.data.length})`));
  }
}
const infos = await asc("GET", `/v1/apps/${APP_ID}/appInfos`);
for (const i of infos.data) {
  const locs = await asc("GET", `/v1/appInfos/${i.id}/appInfoLocalizations`);
  console.log("ASC appInfo", i.id, i.attributes.appStoreState ?? i.attributes.state, locs.data.map((l) => `${l.id} ${l.attributes.locale} name=${l.attributes.name} subtitle=${l.attributes.subtitle} privacy=${l.attributes.privacyPolicyUrl}`));
}

// Google Play
const edit = await play("POST", "/edits", {});
const details = await play("GET", `/edits/${edit.id}/details`);
console.log("Play details:", details);
const listings = await play("GET", `/edits/${edit.id}/listings`);
for (const l of listings.listings ?? []) {
  console.log(`Play listing ${l.language}: title=${l.title} short=${l.shortDescription?.length} full=${l.fullDescription?.length}`);
  for (const t of ["phoneScreenshots", "featureGraphic", "icon"]) {
    const im = await play("GET", `/edits/${edit.id}/listings/${l.language}/${t}`);
    console.log(`  ${t}: ${(im.images ?? []).length}`);
  }
}
await play("DELETE", `/edits/${edit.id}`);
