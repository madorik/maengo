import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDummyAi } from '../ai/dummy';
import { classifyByKeywords, isCategory } from '../categories';

const c = (title: string, short = '', body: string[] = []) => classifyByKeywords({ title, short, body });

test('키워드 분류: 제목과 요약을 더 무겁게 본다', () => {
  assert.equal(c('RAG 답변에 출처 달기', 'LLM이 찾은 문서를 같이 보여 줘요'), 'ai');
  assert.equal(c('PostgreSQL 커넥션 풀 크기 잡기', '서버 수와 DB 한도를 같이 봐요'), 'tech');
  assert.equal(c('원격 근무자를 위한 워케이션', '한 달 살 도시를 고르는 기준', ['숙소와 항공권부터 봐요']), 'travel');
  assert.equal(c('백엔드 면접 시스템 설계 질문', '이직 준비하는 시니어에게'), 'career');
  assert.equal(c('클라우드 비용, 환율이 오르면', '달러로 내는 예산을 다시 봐요'), 'finance');
  assert.equal(c('기능 우선순위 매트릭스의 함정', '임팩트를 숫자로 쪼개요'), 'business');
  assert.equal(c('오늘의 단상'), 'etc');
  // 흔한 기술 단어(API·로그)가 섞여도 주제가 AI면 AI
  assert.equal(c('Gemini API, 유튜브 링크만으로 영상 요약', '공개 영상 URL을 넣으면 요약해 줍니다', ['모델이 화면과 소리를 읽어요']), 'ai');
  assert.equal(c('에이전트 평가, 정답셋 없이 시작하는 법', '실서비스 로그에서 실패한 대화를 모아요', ['배포 전에 평가셋을 돌려요']), 'ai');
  assert.equal(c('디자인 토큰을 코드와 피그마에서 같이 쓰기'), 'design');
  assert.equal(c('한글 웹 폰트 때문에 늦어지는 첫 화면'), 'tech');
});

test('더미 AI도 같은 분류기를 쓰고, 결과는 정해진 목록 안에 있다', async () => {
  const ai = createDummyAi();
  const got = await ai.classify({ model: 'm', title: '디자인 토큰과 피그마', short: '', body: [] });
  assert.equal(got, 'design');
  assert.ok(isCategory(got));
  assert.ok(!isCategory('sports'));
});
