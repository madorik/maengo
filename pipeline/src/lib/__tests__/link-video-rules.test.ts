import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocateLinkVideos, estimateVideoUsd, LINK_VIDEO, withinBudget, type VideoPick } from '../link-video-rules';

const pick = (clusterId: number, minutes: number, publishedAt: number): VideoPick => ({ clusterId, seconds: minutes * 60, publishedAt });

test('사람마다 하루 90분까지, 오래 기다린 영상부터', () => {
  // 채널 1·2·3: 40분(가장 오래됨), 30분, 50분 → 40+30=70분까지 넣고 50분은 넘쳐서 다음 날로
  const picks = new Map([[1, pick(101, 40, 1)], [2, pick(102, 30, 2)], [3, pick(103, 50, 3)]]);
  assert.deepEqual(allocateLinkVideos([{ sources: [3, 2, 1] }], picks), [101, 102]);
});

test('여러 사람이 넣은 채널 영상은 한 번만 고르고, 이미 고른 영상은 넘쳐도 그 사람에게도 센다', () => {
  const picks = new Map([[1, pick(101, 60, 1)], [2, pick(102, 40, 2)], [3, pick(103, 20, 3)]]);
  // A: 채널 1(60)+3(20)=80분. B: 채널 1(이미 고름, 60)+2(40)=100분이라 2는 넘침
  assert.deepEqual(allocateLinkVideos([{ sources: [1, 3] }, { sources: [1, 2] }], picks), [101, 103]);
});

test('후보가 없는 채널은 건너뛰고, 같은 채널을 두 번 적어도 한 번', () => {
  const picks = new Map([[2, pick(102, 10, 1)]]);
  assert.deepEqual(allocateLinkVideos([{ sources: [1, 2, 2] }], picks), [102]);
});

test('하루 예산 안에서 앞에서부터, 넘는 영상은 다음 날로', () => {
  const seconds = new Map([[1, 3600], [2, 1200], [3, 3600]]);
  const one = estimateVideoUsd(3600);
  // 1시간 한 편 값 + 20분 한 편 값이면 1·2만
  assert.deepEqual(withinBudget([1, 2, 3], seconds, one + estimateVideoUsd(1200)), [1, 2]);
  assert.deepEqual(withinBudget([1, 2], seconds, 0), []);
});

test('예상 비용: 1시간 영상이 Premium 한 명 하루 상한(₩52) 안', () => {
  const krw = estimateVideoUsd(3600) * LINK_VIDEO.usdKrw;
  assert.ok(krw > 35 && krw < LINK_VIDEO.krwPerPremium, String(krw));
});
