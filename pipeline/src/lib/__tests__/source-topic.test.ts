import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPIC_BY_ID } from '@maengo/core/topics';
import { SOURCES } from '../../sources';
import { interleaveBy } from '../limit';
import { wantsSourceTopic } from '../source-topic';

test('출처 분야: 있는 토픽 id만, 주소는 겹치지 않는다', () => {
  for (const s of SOURCES) if (s.topic) assert.ok(TOPIC_BY_ID.has(s.topic), `${s.name}: ${s.topic}`);
  const urls = SOURCES.map((s) => s.url);
  assert.equal(new Set(urls).size, urls.length);
});

test('출처 분야: 그 분야·큰 분류·상세 관심사 중 하나를 골랐으면 받는다', () => {
  assert.equal(wantsSourceTopic('security', new Set(['security'])), true);
  assert.equal(wantsSourceTopic('security', new Set(['dev'])), true); // 큰 분류 Tech
  assert.equal(wantsSourceTopic('dev', new Set(['cloud'])), true); // Tech 출처는 클라우드만 골라도
  assert.equal(wantsSourceTopic('security', new Set(['cloud', 'ai'])), false);
  assert.equal(wantsSourceTopic('dev', new Set(['ai', 'politics'])), false);
});

test('임베딩 순서: 출처마다 돌아가며, 출처 안에서는 원래 순서', () => {
  const items = [
    { id: 9, s: 'news' }, { id: 8, s: 'news' }, { id: 7, s: 'news' },
    { id: 3, s: 'geek' }, { id: 2, s: 'hn' }, { id: 1, s: 'geek' },
  ];
  assert.deepEqual(interleaveBy(items, (i) => i.s).map((i) => i.id), [9, 3, 2, 8, 1, 7]);
  assert.deepEqual(interleaveBy([], (i) => i), []);
});
