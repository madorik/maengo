import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_MATCHED, parseYoutubeSections, sectionsFromChannels } from '../youtube-sections';

const ch = (title: string, description = '') => ({ title, description });

test('유튜브 구독 채널을 분야로 묶는다: 많이 구독한 분야가 비중이 크다', () => {
  const r = sectionsFromChannels([
    ch('주식 읽어주는 남자', '코스피 코스닥 증시 분석'),
    ch('경제 브리핑', '금리와 환율, 물가'),
    ch('코인 데일리', '비트코인 이더리움 가상자산'),
    ch('야구 하이라이트', '프로야구 KBO 홈런 모음'),
    ch('요리하는 일상', ''),
    ch('브이로그'),
  ]);
  assert.ok(r);
  assert.equal(r.weights.economy, 1.5);
  assert.ok((r.weights.sports ?? 0) > 0.8 && (r.weights.sports ?? 0) < 1.5);
  assert.deepEqual(r.channels.economy, ['주식 읽어주는 남자', '경제 브리핑', '코인 데일리']);
  // 분야를 못 정한 채널(브이로그)은 빼고 센다
  assert.equal(r.matched, 5);
});

test('분야를 정한 채널이 적으면 쓰지 않는다(소식 고르기로)', () => {
  assert.equal(MIN_MATCHED, 3);
  assert.equal(sectionsFromChannels([ch('야구 채널', 'KBO'), ch('브이로그'), ch('먹방')]), null);
});

test('쿠키 값 읽기: 모양이 틀리면 null', () => {
  const r = sectionsFromChannels([ch('국회 소식', '국회 여야 정당'), ch('대통령 연설'), ch('선거 분석', '선거')]);
  assert.deepEqual(parseYoutubeSections(JSON.stringify(r)), r);
  assert.equal(parseYoutubeSections('{"weights":{"nope":1},"channels":{},"matched":3}'), null);
  assert.equal(parseYoutubeSections('not json'), null);
  assert.equal(parseYoutubeSections(undefined), null);
});
