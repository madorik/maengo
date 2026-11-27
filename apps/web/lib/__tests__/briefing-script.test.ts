import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { briefingScript, briefingTitle } from '../briefing-script';

const flow = (title: string, points?: string[], extra: { fact?: string; text?: string } = {}) => ({ title, text: extra.text ?? '', ids: [1], points, fact: extra.fact });

describe('briefingScript', () => {
  it('인사 → 제목 → 흐름마다 제목·핵심 사실·핵심 두 줄(한 문단) → 마무리', () => {
    const lines = briefingScript(
      {
        headline: 'AI 투자 불안에 기술주 변동성이 커졌어요',
        flows: [
          flow('AI 투자 불안 확산', ['AI 인프라 빚 부담에 엔비디아 등급 강등 검토', '10월 물가 3.8% 올라 금리 인하 기대 후퇴', '세 번째 줄은 읽지 않음'], { fact: '나스닥 장중 4.6% 급락 후 낙폭 축소' }),
          flow('SK그룹 시총 급감', ['SK하이닉스 하루 11% 하락']),
        ],
      },
      'am',
    );
    assert.deepEqual(lines, [
      { text: '출근길 브리핑입니다.' },
      { text: 'AI 투자 불안에 기술주 변동성이 커졌어요.' },
      { text: 'AI 투자 불안 확산.', para: 0 },
      { text: '나스닥 장중 4.6% 급락 후 낙폭 축소.', para: 0 },
      { text: 'AI 인프라 빚 부담에 엔비디아 등급 강등 검토.', para: 0 },
      { text: '10월 물가 3.8% 올라 금리 인하 기대 후퇴.', para: 0 },
      { text: 'SK그룹 시총 급감.', para: 1 },
      { text: 'SK하이닉스 하루 11% 하락.', para: 1 },
      { text: '이어서 소식을 하나씩 들려 드릴게요.' },
    ]);
  });

  it('요약 줄이 없는 예전 흐름은 핵심 사실, 그것도 없으면 설명의 첫 문장', () => {
    const lines = briefingScript({ headline: '제목', flows: [flow('가', undefined, { fact: '사실 한 줄' }), flow('나', [], { text: '첫 문장. 둘째 문장.' })] }, 'pm');
    assert.equal(lines[0]!.text, '퇴근길 브리핑입니다.');
    assert.deepEqual(
      lines.filter((l) => l.para !== undefined).map((l) => l.text),
      ['가.', '사실 한 줄.', '나.', '첫 문장.'],
    );
  });

  it('핵심 사실이 요약 줄과 같으면 한 번만 읽는다', () => {
    const lines = briefingScript({ headline: '제목', flows: [flow('가', ['같은 줄', '다른 줄'], { fact: '같은 줄' })] }, 'am');
    assert.deepEqual(
      lines.filter((l) => l.para !== undefined).map((l) => l.text),
      ['가.', '같은 줄.', '다른 줄.'],
    );
  });

  it('호칭은 떼고(이름을 TTS로 보내지 않는다) 읽을 흐름이 없으면 빈 목록', () => {
    const lines = briefingScript({ headline: 'OO님이 보는 금리, 오늘 내려요', flows: [flow('금리', ['기준금리 동결'])] }, 'am');
    assert.equal(lines[1]!.text, '보는 금리, 오늘 내려요.');
    assert.deepEqual(briefingScript({ headline: '제목', flows: [flow('제목만', [])] }, 'am'), []);
  });

  it('챕터 이름', () => {
    assert.equal(briefingTitle('am'), '출근길 브리핑');
    assert.equal(briefingTitle('pm'), '퇴근길 브리핑');
  });
});
