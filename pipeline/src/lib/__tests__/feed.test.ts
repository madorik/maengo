import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDate, parseFeed } from '../feed';
import { canonicalUrl } from '../url';

test('주소 정리: 추적 파라미터와 미디엄 rss 꼬리표를 걷어 낸다', () => {
  assert.equal(canonicalUrl('https://Example.com/post/?utm_source=x&id=3#top'), 'https://example.com/post?id=3');
  assert.equal(canonicalUrl('https://medium.com/daangn/abc-123?source=rss----4505f82a2dbd---4'), 'https://medium.com/daangn/abc-123');
  assert.equal(canonicalUrl('https://youtu.be/dQw4w9WgXcQ?t=5'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(canonicalUrl('https://news.hada.io/topic?id=35043'), 'https://news.hada.io/topic?id=35043');
});

test('시간대 없는 날짜: 한국 매체는 KST, 그 밖은 UTC로 본다', () => {
  assert.equal(parseDate('2026-10-09 12:45:25', 'ko')?.toISOString(), '2026-10-09T03:45:25.000Z');
  assert.equal(parseDate('2026-10-09 12:45:25', 'en')?.toISOString(), '2026-10-09T12:45:25.000Z');
  assert.equal(parseDate('Fri, 09 Oct 2026 06:51:06 GMT', 'ko')?.toISOString(), '2026-10-09T06:51:06.000Z');
  assert.equal(parseDate('', 'en'), null);
});

test('RSS와 Atom을 같은 모양으로 읽는다', () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><title>A &amp; B</title><link>https://a.com/1</link>
    <pubDate>2026-10-09 09:00:00</pubDate><description><![CDATA[<p>본문 <b>요약</b></p>]]></description><dc:creator>홍길동</dc:creator></item></channel></rss>`;
  const [r] = parseFeed(rss, 'ko');
  assert.equal(r?.title, 'A & B');
  assert.equal(r?.excerpt, '본문 요약');
  assert.equal(r?.author, '홍길동');
  assert.equal(r?.publishedAt?.toISOString(), '2026-10-09T00:00:00.000Z');

  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Hello</title><link rel="alternate" href="https://b.com/2"/>
    <published>2026-10-09T14:03:14+09:00</published><author><name>neo</name></author><summary>Short</summary></entry></feed>`;
  const [a] = parseFeed(atom, 'en');
  assert.equal(a?.url, 'https://b.com/2');
  assert.equal(a?.author, 'neo');
  assert.equal(a?.publishedAt?.toISOString(), '2026-10-09T05:03:14.000Z');
});

test('인기 신호: 유튜브 조회수와 해커 뉴스 점수를 읽는다', () => {
  const yt = `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
    <entry><yt:videoId>AHlWV-nI9yo</yt:videoId><title>영상</title><published>2026-10-09T13:44:09+00:00</published>
    <media:group><media:description>설명</media:description><media:community><media:starRating count="73" average="5.00" min="1" max="5"/>
    <media:statistics views="7967"/></media:community></media:group></entry></feed>`;
  const [v] = parseFeed(yt, 'ko');
  assert.equal(v?.views, 7967);
  assert.equal(v?.hnPoints, null);

  const hn = `<rss version="2.0"><channel><item><title>Bitwarden</title><link>https://community.bitwarden.com/t/1</link>
    <description><![CDATA[<p>Comments URL: <a href="https://news.ycombinator.com/item?id=50033407">x</a></p><p>Points: 260</p><p># Comments: 193</p>]]></description>
    <pubDate>Sat, 10 Oct 2026 14:32:50 +0000</pubDate></item>
    <item><title>보통 글</title><link>https://a.com/2</link><description>Points: 999 이라는 문장이 든 일반 글</description></item></channel></rss>`;
  const [h, plain] = parseFeed(hn, 'en');
  assert.equal(h?.hnPoints, 260);
  assert.equal(h?.views, null);
  assert.equal(plain?.hnPoints, null);
});
