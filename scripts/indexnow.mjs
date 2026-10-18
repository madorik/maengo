// IndexNow: 바뀐 공개 페이지 주소를 검색엔진(빙·네이버·얀덱스 등)에 바로 알린다. 소유 확인 없이 키 파일만으로 된다.
// 키 파일은 회사 사이트에 있다(apps/company/<KEY>.txt → https://watalabs.com/<KEY>.txt). 키를 바꾸면 그 파일도 바꾼다.
// 두 사이트맵의 주소를 모두 보낸다. 회사 사이트·맹고를 배포한 뒤에 실행: node scripts/indexnow.mjs
// 주소를 직접 주면 그것만 보낸다: node scripts/indexnow.mjs https://watalabs.com/maengo/topics/ai
const KEY = 'c1807746d79505e8419d1deba0cf7f63';
const HOST = 'watalabs.com';
const SITEMAPS = ['https://watalabs.com/sitemap.xml', 'https://watalabs.com/maengo/sitemap.xml'];

async function sitemapUrls() {
  const urls = [];
  for (const sitemap of SITEMAPS) {
    const res = await fetch(sitemap);
    if (!res.ok) throw new Error(`${sitemap}: ${res.status}`);
    for (const m of (await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1].trim());
  }
  return urls;
}

const urlList = process.argv.length > 2 ? process.argv.slice(2) : await sitemapUrls();
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
// 200·202면 받은 것. 403은 키 파일을 못 읽은 것(배포 전이거나 주소가 다름), 422는 주소가 host와 다름
console.log(`IndexNow ${res.status} ${res.statusText}: 주소 ${urlList.length}개`);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}
