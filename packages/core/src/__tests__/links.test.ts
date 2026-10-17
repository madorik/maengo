import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockedHost, feedLinksInHtml, feedUrlKey, guessLang, isHttpInput, isIpHost, isLinkTopicId, isUnsafeLinkUrl, isPrivateHost, linkSourceId, linkTopicId, looksLikeFeedUrl, normalizeLinkInput, platformFeedUrls,
} from '../topics/links';

test('링크 토픽 id', () => {
  assert.equal(linkTopicId(12), 's-12');
  assert.ok(isLinkTopicId('s-12'));
  assert.ok(!isLinkTopicId('c-0123456789abcdef'));
  assert.ok(!isLinkTopicId('stock'));
  assert.equal(linkSourceId('s-7'), 7);
  assert.equal(linkSourceId('dev'), null);
});

test('주소 정리: 프로토콜을 붙이고, https가 아니거나 주소가 아니면 null', () => {
  assert.equal(normalizeLinkInput(' toss.tech ')?.toString(), 'https://toss.tech/');
  assert.equal(normalizeLinkInput('https://d2.naver.com/d2.atom#x')?.toString(), 'https://d2.naver.com/d2.atom');
  assert.equal(normalizeLinkInput('ftp://a.com/x'), null);
  assert.equal(normalizeLinkInput('http://a.com/x'), null);
  assert.equal(normalizeLinkInput('HTTP://a.com'), null);
  assert.equal(normalizeLinkInput('드론'), null);
  assert.equal(normalizeLinkInput('a b.com'), null);
  assert.equal(normalizeLinkInput(''), null);
  assert.ok(isHttpInput(' http://a.com'));
  assert.ok(isHttpInput('HTTP://a.com'));
  assert.ok(!isHttpInput('https://a.com'));
  assert.ok(!isHttpInput('a.com/http://x'));
});

test('막는 곳: 유튜브, RSS 없는 SNS·브런치. 사설·로컬 주소', () => {
  assert.equal(blockedHost('www.youtube.com'), 'youtube');
  assert.equal(blockedHost('youtu.be'), 'youtube');
  assert.equal(blockedHost('brunch.co.kr'), 'blocked');
  assert.equal(blockedHost('x.com'), 'blocked');
  assert.equal(blockedHost('toss.tech'), null);
  assert.equal(blockedHost('notyoutube.com'), null);
  for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '172.16.3.4', '192.168.0.1', '169.254.169.254', '::1', '[::1]', 'db.internal', 'fe80::1']) assert.ok(isPrivateHost(h), h);
  for (const h of ['toss.tech', '8.8.8.8', '172.32.0.1', '2606:4700::1111']) assert.ok(!isPrivateHost(h), h);
});

test('플랫폼 피드 주소 규칙', () => {
  const f = (u: string) => platformFeedUrls(new URL(u));
  assert.deepEqual(f('https://abc.tistory.com/123'), ['https://abc.tistory.com/rss']);
  assert.deepEqual(f('https://velog.io/@kim/posts'), ['https://v2.velog.io/rss/@kim']);
  assert.deepEqual(f('https://blog.naver.com/kimdev'), ['https://rss.blog.naver.com/kimdev.xml']);
  assert.deepEqual(f('https://medium.com/@user'), ['https://medium.com/feed/@user']);
  assert.deepEqual(f('https://medium.com/daangn'), ['https://medium.com/feed/daangn']);
  assert.deepEqual(f('https://foo.substack.com/'), ['https://foo.substack.com/feed']);
  assert.deepEqual(f('https://github.com/vercel/next.js/releases'), ['https://github.com/vercel/next.js/releases.atom']);
  assert.deepEqual(f('https://www.reddit.com/r/rust/'), ['https://www.reddit.com/r/rust/.rss']);
  assert.deepEqual(f('https://toss.tech/'), []);
});

test('피드처럼 보이는 주소', () => {
  assert.ok(looksLikeFeedUrl(new URL('https://toss.tech/rss.xml')));
  assert.ok(looksLikeFeedUrl(new URL('https://a.com/feed/')));
  assert.ok(looksLikeFeedUrl(new URL('https://a.com/blog/rss')));
  assert.ok(looksLikeFeedUrl(new URL('https://a.com/?feed=rss2')));
  assert.ok(!looksLikeFeedUrl(new URL('https://a.com/posts/1')));
});

test('HTML에서 피드 링크 찾기(상대 주소, 작은따옴표, 순서)', () => {
  const html = `<html><head><title>블로그</title>
    <link rel="stylesheet" href="/a.css">
    <link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml">
    <link rel='alternate' type='application/atom+xml' href='https://b.com/atom.xml'/>
    <link rel="alternate" type="application/json" href="/feed.json">
    </head><body></body></html>`;
  assert.deepEqual(feedLinksInHtml(html, 'https://a.com/blog/'), ['https://a.com/rss.xml', 'https://b.com/atom.xml']);
  assert.deepEqual(feedLinksInHtml('<p>no head</p>', 'https://a.com'), []);
  // link 태그가 없으면 본문의 피드처럼 보이는 링크(네이버 D2의 d2.atom). 사이트맵·일반 링크는 아니다
  const body = `<html><body><a href="/sitemap.xml">sitemap</a><a href="https://d2.naver.com/d2.atom">RSS</a><a href="/posts/1">글</a><a href="/feed/">피드</a></body></html>`;
  assert.deepEqual(feedLinksInHtml(body, 'https://d2.naver.com/home'), ['https://d2.naver.com/d2.atom', 'https://d2.naver.com/feed/']);
});

test('피드 주소 키와 언어 짐작', () => {
  assert.equal(feedUrlKey('https://Toss.tech/rss.xml/#top'), 'https://toss.tech/rss.xml');
  assert.equal(guessLang(['Hello', '토스 기술 블로그']), 'ko');
  assert.equal(guessLang(['Hello', 'World']), 'en');
});

test('주소 모양으로 막는 링크: IP 그대로·다른 포트·주소 안의 계정·내부 이름', () => {
  assert.ok(isIpHost('127.0.0.1'));
  assert.ok(isIpHost('[::1]'));
  assert.ok(!isIpHost('toss.tech'));
  const bad = ['https://8.8.8.8/', 'https://0x7f.1/', 'https://2130706433/', 'https://[2606:4700::1111]/', 'https://a.com:8443/', 'https://u:p@a.com/', 'https://intra.local/', 'https://localhost/'];
  for (const raw of bad) assert.ok(isUnsafeLinkUrl(new URL(raw)), raw);
  for (const raw of ['https://toss.tech/', 'https://a.com:443/feed', 'https://blog.naver.com/x']) assert.ok(!isUnsafeLinkUrl(new URL(raw)), raw);
});
