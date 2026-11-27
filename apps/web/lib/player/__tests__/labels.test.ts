import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { WAIT_DELAY_MS, waitFill, waitStageAt, waitStages } from '../labels';
import { waitCues } from '../../voice-samples';

describe('기다림 단계(화면과 안내 음성이 같은 때 같은 말)', () => {
  it('Free: 처음 10초 정도 → 8.5초 거의 다 됨 → 15초 듣는 분이 많음 → 30초 고마움', () => {
    assert.equal(waitStageAt(0, false).note, '10초 정도 걸릴 것 같아요. 조금만 기다려주세요~!');
    assert.equal(waitStageAt(8000, false).title, '조금 더 자연스러운 문장으로 다듬고 있어요');
    assert.equal(waitStageAt(8600, false).title, '거의 다 됐어요');
    assert.equal(waitStageAt(15_500, false).title, '오늘따라 듣는 분이 많네요');
    assert.equal(waitStageAt(31_000, false).title, '기다려 주셔서 고마워요');
  });
  it("Premium은 5초 정도, '거의 다 됨' 없이 9초에 늦어짐", () => {
    assert.equal(waitStageAt(0, true).note, '5초 정도 걸릴 것 같아요. 조금만 기다려주세요~!');
    assert.equal(waitStages(true).some((s) => s.title === '거의 다 됐어요'), false);
    assert.equal(waitStageAt(9500, true).title, '오늘따라 듣는 분이 많네요');
  });
  it('막대 한 줄은 좁은 자리용 짧은 말(15자 안)', () => {
    assert.equal(waitStageAt(0, false).short, '다듬는 중이에요, 10초쯤');
    for (const p of [false, true]) for (const s of waitStages(p)) assert.ok(s.short.length <= 15, s.short);
  });
  it("안내 음성에는 '~'를 넣지 않는다", () => {
    for (const p of [false, true]) for (const s of waitStages(p)) assert.ok(!s.say.includes('~'), s.say);
  });
  it('안내 음성의 말은 단계 시각에서 안내가 늦게 켜지는 만큼 앞당긴다', () => {
    const cues = waitCues('chirp');
    assert.deepEqual(
      cues.map((c) => c.atMs),
      waitStages(false).map((s) => Math.max(0, s.atMs - WAIT_DELAY_MS)),
    );
    assert.equal(cues[0]!.text, '조금 더 자연스러운 문장으로 다듬고 있어요. 10초 정도 걸릴 것 같아요. 조금만 기다려 주세요!');
    assert.equal(waitCues('gemini').length, 3);
  });
  it('진행 막대는 끝까지 채우지 않는다', () => {
    assert.ok(waitFill(12_000, false) <= 0.9 + 1e-9);
    assert.ok(waitFill(120_000, false) < 0.97 + 1e-9);
    assert.ok(waitFill(6000, false) < waitFill(9000, false));
  });
});
