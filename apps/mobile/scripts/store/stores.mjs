// 스토어 API 공용: App Store Connect(ES256 JWT), Google Play(서비스 계정 RS256 → OAuth 토큰)
import { createSign, createPrivateKey, sign as cryptoSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const b64u = (b) => Buffer.from(b).toString("base64url");

// ---------- App Store Connect ----------
// 키 ID·Issuer ID·앱 ID는 저장소 밖 ~/.maengo/store-api.json에 둔다(공개 저장소라서). {"ascKeyId","ascIssuerId","ascAppId"}
const CFG = JSON.parse(readFileSync(`${homedir()}/.maengo/store-api.json`, "utf8"));
const ASC = { keyId: CFG.ascKeyId, issuer: CFG.ascIssuerId, key: `${homedir()}/.maengo/AuthKey_${CFG.ascKeyId}_Connect.p8` };
export const APP_ID = CFG.ascAppId;
function ascToken() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: ASC.keyId, typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: ASC.issuer, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" }));
  const sig = cryptoSign("sha256", Buffer.from(`${head}.${body}`), { key: createPrivateKey(readFileSync(ASC.key)), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}
export async function asc(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { authorization: `Bearer ${ascToken()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ASC ${method} ${path} → ${res.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : null;
}

// ---------- Google Play ----------
export const PKG = "kr.maengo.app";
let playTok;
export async function playToken() {
  if (playTok) return playTok;
  const sa = JSON.parse(readFileSync(`${homedir()}/.maengo/play-service-account.json`, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: sa.token_uri, iat: now, exp: now + 3500 }));
  const s = createSign("RSA-SHA256");
  s.update(`${head}.${body}`);
  const jwt = `${head}.${body}.${b64u(s.sign(sa.private_key))}`;
  const res = await fetch(sa.token_uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  playTok = (await res.json()).access_token;
  return playTok;
}
export async function play(method, path, body, { upload, contentType } = {}) {
  const base = upload ? "https://androidpublisher.googleapis.com/upload/androidpublisher/v3" : "https://androidpublisher.googleapis.com/androidpublisher/v3";
  const res = await fetch(`${base}/applications/${PKG}${path}${upload ? (path.includes("?") ? "&" : "?") + "uploadType=media" : ""}`, {
    method,
    headers: { authorization: `Bearer ${await playToken()}`, "content-type": upload ? contentType : "application/json" },
    body: upload ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Play ${method} ${path} → ${res.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : null;
}
