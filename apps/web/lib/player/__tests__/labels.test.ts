import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { WAIT_DELAY_MS, waitFill, waitShort, waitStageAt, waitStages } from '../labels';
import { waitCues } from '../../voice-samples';

describe('기다림 단계(화면과 안내 음성이 같은 때 같은 말)', () => {
  it('Free: 처음 10초쯤 → 8초 곧 → 15초 늦어짐 → 30초 더 늦어짐', () => {
    assert.equal(waitStageAt(0, false).note, '10초쯤 걸려요');
    assert.equal(waitStageAt(8500, false).note, '곧 들려 드릴게요');
    assert.equal(waitStageAt(15_500, false).title, '조금 더 걸리고 있어요');
    assert.equal(waitStageAt(31_000, false).note, '조금만 더 기다려 주세요');
  });
  it("Premium은 5초쯤, '곧' 없이 9초에 늦어짐", () => {
    assert.equal(waitStageAt(0, true).note, '5초쯤 걸려요');
    assert.equal(waitStages(true).some((s) => s.note === '곧 들려 드릴게요'), false);
    assert.equal(waitStageAt(9500, true).title, '조금 더 걸리고 있어요');
  });
  it('막대 한 줄도 단계를 따른다', () => {
    assert.equal(waitShort(waitStageAt(0, false), false), '목소리 만드는 중, 10초쯤');
    assert.equal(waitShort(waitStageAt(8500, false), false), '곧 들려 드릴게요');
    assert.equal(waitShort(waitStageAt(16_000, false), false), '조금 더 걸리고 있어요');
  });
  it('안내 음성의 말은 단계 시각에서 안내가 늦게 켜지는 만큼 앞당긴다', () => {
    const cues = waitCues('chirp');
    assert.deepEqual(
      cues.map((c) => c.atMs),
      waitStages(false).map((s) => Math.max(0, s.atMs - WAIT_DELAY_MS)),
    );
    assert.equal(cues[0]!.text, '자연스러운 목소리로 만들고 있어요. 10초쯤 걸려요.');
    assert.equal(waitCues('gemini').length, 3);
  });
  it('진행 막대는 끝까지 채우지 않는다', () => {
    assert.ok(waitFill(12_000, false) <= 0.9 + 1e-9);
    assert.ok(waitFill(120_000, false) < 0.97 + 1e-9);
    assert.ok(waitFill(6000, false) < waitFill(9000, false));
  });
});
