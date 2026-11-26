import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstSentence, TOPIC_BLURBS, topicBlurb, topicMetaDescription } from '../public-topic-blurbs';
import { PUBLIC_DETAILS, PUBLIC_TOPICS } from '../public-topics';

// 공개 분야 5개와 그 아래 세부 주제 전부(토픽 사전의 childrenOf)에 설명이 있어야 한다. 사전에 주제를 더하고 설명을 빼먹으면 여기서 잡힌다
const ALL = [...PUBLIC_TOPICS.map((t) => ({ id: t.id, name: t.name })), ...PUBLIC_DETAILS.map((d) => ({ id: d.id, name: d.name }))];
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

test('공개 분야와 세부 주제 전부에 설명이 있고 남는 설명도 없다', () => {
  assert.ok(ALL.length >= 27, '분야 5개 + 세부 주제 22개');
  assert.deepEqual(
    ALL.filter((t) => !TOPIC_BLURBS[t.id]).map((t) => t.id),
    [],
    '설명이 빠진 주제',
  );
  assert.deepEqual(
    Object.keys(TOPIC_BLURBS)
      .filter((id) => !ALL.some((t) => t.id === id))
      .sort(),
    [],
    '사전에 없는 주제의 설명',
  );
});

test('설명은 2~3문장 해요체이고, 이름이 들어 있고, 서로 다르다', () => {
  for (const { id, name } of ALL) {
    const text = topicBlurb(id, name);
    const n = sentences(text).length;
    assert.ok(n >= 2 && n <= 3, `${id}: ${n}문장`);
    assert.ok(text.endsWith('요.'), `${id}: 해요체 마침표로 끝나야 해요`);
    assert.ok(text.includes(name), `${id}: 설명에 주제 이름(${name})이 있어야 해요`);
    assert.ok(text.length >= 90 && text.length <= 330, `${id}: 길이 ${text.length}자`);
  }
  assert.equal(new Set(ALL.map((t) => topicBlurb(t.id, t.name))).size, ALL.length);
  assert.equal(new Set(ALL.map((t) => firstSentence(topicBlurb(t.id, t.name)))).size, ALL.length, '첫 문장(메타 설명)도 겹치지 않는다');
});

test('설명은 화면 용어 정책(검색어 "뉴스 요약"은 제목·설명·키워드에만)과 투자 권유 금지를 지킨다', () => {
  for (const { id, name } of ALL) {
    const text = topicBlurb(id, name);
    assert.ok(!text.includes('뉴스 요약'), `${id}: 화면 문구는 '소식'`);
    assert.ok(!/추천|매수|매도|유망|보장|수익률/.test(text), `${id}: 투자 권유·수익 표현은 쓰지 않는다`);
    assert.ok(!/\d+(%|배|조|억|만 원)/.test(text), `${id}: 숫자(지어낸 수치)는 쓰지 않는다`);
  }
});

test('첫 문장은 "Next.js"처럼 공백 없는 점에서 끊기지 않는다', () => {
  assert.equal(firstSentence('Next.js 새 버전이 나왔어요. 둘째 문장이에요.'), 'Next.js 새 버전이 나왔어요.');
  assert.equal(firstSentence('한 문장뿐이에요.'), '한 문장뿐이에요.');
});

test('메타 description은 설명 첫 문장 + 검색어 한 줄, 160자 안팎이고 쪽마다 다르다', () => {
  for (const { id, name } of ALL) {
    const d = topicMetaDescription(id, name);
    assert.ok(d.startsWith(firstSentence(topicBlurb(id, name))), `${id}: 첫 문장으로 시작`);
    assert.ok(d.includes(`${name} 뉴스 요약`), `${id}: 검색어`);
    assert.ok(d.length <= 160, `${id}: ${d.length}자`);
    assert.notEqual(topicMetaDescription(id, name, 2), d);
    assert.ok(topicMetaDescription(id, name, 2).length <= 170, `${id}: 2쪽 ${topicMetaDescription(id, name, 2).length}자`);
  }
  assert.equal(new Set(ALL.map((t) => topicMetaDescription(t.id, t.name))).size, ALL.length, '주제마다 다른 description');
});

test('설명이 없는 새 주제도 이름만 쓴 한 문장으로 버틴다', () => {
  assert.equal(topicBlurb('no-such', '새 주제'), '새 주제 분야의 새 소식을 다뤄요.');
});
