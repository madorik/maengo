import assert from 'node:assert/strict';
import { test } from 'node:test';
import { singleStarted, viaTodayPlayer, type RouteState } from '../route';

const base: RouteState = { inPlayer: true, playlist: false, audioReady: false, playerBusy: false, singleBusy: false };

test('viaTodayPlayer: 플레이어 목록에 없거나 플레이리스트를 듣는 중이면 글 하나로', () => {
  assert.equal(viaTodayPlayer({ ...base, inPlayer: false, audioReady: true, playerBusy: true }), false);
  assert.equal(viaTodayPlayer({ ...base, playlist: true, audioReady: true, playerBusy: true }), false);
});

test('viaTodayPlayer: 전체 음성이 있거나 플레이어가 돌고 있으면 플레이어로', () => {
  assert.equal(viaTodayPlayer(base), false);
  assert.equal(viaTodayPlayer({ ...base, audioReady: true }), true);
  assert.equal(viaTodayPlayer({ ...base, playerBusy: true }), true);
});

test('viaTodayPlayer: 글 하나 듣기가 돌던 중에 에피소드 정보가 늦게 와도 글 하나로 둔다', () => {
  assert.equal(viaTodayPlayer({ ...base, audioReady: true, singleBusy: true }), false);
});

test('viaTodayPlayer: 플레이어가 시작되면 글 하나 듣기가 돌던 중이어도 플레이어가 이어받는다', () => {
  assert.equal(viaTodayPlayer({ ...base, playerBusy: true, singleBusy: true }), true);
  assert.equal(viaTodayPlayer({ ...base, audioReady: true, playerBusy: true, singleBusy: true }), true);
});

test('singleStarted: 재생·멈춤·다 들음·음성 기다림이면 시작한 것', () => {
  assert.equal(singleStarted({ state: 'idle' }), false);
  assert.equal(singleStarted({ state: 'locked' }), false);
  assert.equal(singleStarted({ state: 'idle', preparing: true }), true);
  assert.equal(singleStarted({ state: 'playing' }), true);
  assert.equal(singleStarted({ state: 'paused' }), true);
  assert.equal(singleStarted({ state: 'finished' }), true);
});
