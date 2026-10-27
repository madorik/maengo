import assert from 'node:assert/strict';
import { test } from 'node:test';
import { impactOf, isAiModelRelease, isSecurityThreat, titleImpact } from '../feed/impact';

test('새 AI 모델 출시는 제목으로 알아본다', () => {
  for (const t of [
    'OpenAI, GPT-5.5 출시…추론 속도 두 배',
    'Anthropic releases Claude Opus 5',
    '앤트로픽, 새 AI 모델 공개',
    '구글, 제미나이 3 공개',
    'DeepSeek-V4 is now available',
    '메타, 오픈소스 AI 모델 라마 5 공개',
    'OpenAI launches o5-mini',
    'LG AI연구원, 엑사원 5.0 공개',
    '앤트로픽, 오퍼스 5 출시',
  ])
    assert.ok(isAiModelRelease(t), t);
  for (const t of [
    '삼성, 갤럭시 새 모델 출시',
    '구글 신형 픽셀 모델 공개',
    'GPT-6 출시 임박…다음 달 공개 전망',
    'OpenAI, 새 쇼핑 기능 출시',
    '앤트로픽, IPO 앞두고 매출 15배 급증',
    '현대차, 새 전기차 모델 공개',
  ])
    assert.ok(!isAiModelRelease(t), t);
});

test('보안 위협(취약점·해킹·유출·악성코드)은 제목으로 알아본다', () => {
  for (const t of [
    '크롬 제로데이 취약점, 긴급 패치 배포',
    'SK텔레콤 고객 정보 유출 2,300만 명',
    'Ransomware gang hits US hospital chain',
    'npm 공급망 공격으로 패키지 18개 감염',
    'Hackers exploit Fortinet flaw',
    'CVE-2026-1234: OpenSSH 원격 실행',
  ])
    assert.ok(isSecurityThreat(t), t);
  for (const t of ['서울시 AI 해커톤 개최', '스타트업 그로스 해킹 전략', 'Our first hackathon recap', 'Inside Shopify Hack Days', '보안 업계 채용 늘어']) assert.ok(!isSecurityThreat(t), t);
});

test('AI가 매긴 무게가 있으면 제목보다 그것을 따른다', () => {
  assert.equal(titleImpact('Anthropic releases Claude Opus 5'), 'major');
  assert.equal(titleImpact('서울 아침 기온 영하'), null);
  assert.equal(impactOf({ title: 'Anthropic releases Claude Opus 5' }), 'major');
  assert.equal(impactOf({ impact: 'routine', title: 'Anthropic releases Claude Opus 5' }), 'routine');
  assert.equal(impactOf({ impact: 'major', title: '금통위, 기준금리 동결' }), 'major');
  assert.equal(impactOf({ impact: null, title: null }), null);
});
