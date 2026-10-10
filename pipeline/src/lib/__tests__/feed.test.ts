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
