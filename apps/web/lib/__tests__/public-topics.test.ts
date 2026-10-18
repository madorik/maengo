import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOPIC_GROUPS } from '@maengo/core/topics';
import { detailsLine, PUBLIC_TOPICS, publicTopicBySlug, topicsPath } from '../public-topics';

test('공개 분야는 관심 분야 5개이고 주소가 겹치지 않는다', () => {
  assert.deepEqual(
    PUBLIC_TOPICS.map((t) => t.id),
    TOPIC_GROUPS.map((t) => t.id),
  );
  assert.equal(new Set(PUBLIC_TOPICS.map((t) => t.slug)).size, PUBLIC_TOPICS.length);
});

test('Tech(dev)만 주소가 tech이고 뉴스 분야는 열지 않는다', () => {
  assert.equal(publicTopicBySlug('tech')?.id, 'dev');
  assert.equal(publicTopicBySlug('dev'), undefined);
  assert.equal(publicTopicBySlug('politics'), undefined);
  assert.equal(topicsPath('tech'), '/topics/tech');
});

test('세부 관심사 줄은 max개까지 쓰고 남으면 "등"을 붙인다', () => {
  const ai = publicTopicBySlug('ai')!;
  assert.ok(ai.details.length > 3);
  assert.equal(detailsLine(ai, 2), `${ai.details[0]}, ${ai.details[1]} 등`);
  assert.equal(detailsLine(ai), ai.details.join(', '));
});
