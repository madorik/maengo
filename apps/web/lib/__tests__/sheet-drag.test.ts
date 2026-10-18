import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DISMISS_MAX, FLICK_VELOCITY, releaseVelocity, sheetOffset, shouldDismiss } from '../sheet-drag';

test('sheetOffset: 아래로는 손가락 그대로, 위로는 조금만', () => {
  assert.equal(sheetOffset(0), 0);
  assert.equal(sheetOffset(120), 120);
  const up = sheetOffset(-200);
  assert.ok(up < 0 && up > -56);
  assert.ok(sheetOffset(-400) < up); // 더 끌면 조금 더 올라오되
  assert.ok(sheetOffset(-400) > -56); // 한도는 넘지 않는다
});

test('shouldDismiss: 천천히 조금 끌면 돌아간다, 많이 끌면 닫힌다', () => {
  assert.equal(shouldDismiss(40, 0, 500), false);
  assert.equal(shouldDismiss(210, 0, 500), true); // 500의 40% = 200
  assert.equal(shouldDismiss(150, 0, 300), true); // 짧은 시트는 높이 비율로
});

test('shouldDismiss: 긴 시트도 상한만큼 끌면 닫힌다', () => {
  assert.equal(shouldDismiss(DISMISS_MAX + 1, 0, 2000), true);
  assert.equal(shouldDismiss(DISMISS_MAX - 1, 0, 2000), false);
});

test('shouldDismiss: 아래로 던지면 조금만 끌어도 닫히고, 위로 되던지면 남는다', () => {
  assert.equal(shouldDismiss(20, FLICK_VELOCITY + 1, 600), true);
  // 던진 속도로 더 갈 거리까지 더한다(500px/초 → 약 50px)
  assert.equal(shouldDismiss(180, 500, 600), true);
  assert.equal(shouldDismiss(180, 0, 600), false);
  assert.equal(shouldDismiss(400, -800, 600), false);
});

test('shouldDismiss: 위로 올라가 있으면 닫지 않는다', () => {
  assert.equal(shouldDismiss(-10, 2000, 600), false);
  assert.equal(shouldDismiss(0, 0, 600), false);
});

test('releaseVelocity: 최근 100ms의 움직임으로 잰다', () => {
  assert.equal(releaseVelocity([{ t: 0, y: 0 }, { t: 50, y: 50 }], 50), 1000);
  // 오래전 움직임은 빼고 본다
  assert.equal(releaseVelocity([{ t: 0, y: 0 }, { t: 400, y: 300 }, { t: 450, y: 300 }], 450), 0);
  assert.equal(releaseVelocity([{ t: 0, y: 0 }], 10), 0);
  assert.equal(releaseVelocity([], 10), 0);
});
