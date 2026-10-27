// 소식의 무게: 새 기술이나 사회에 영향을 주는 소식을 그냥 소식보다 먼저 준다(2026-10-27 사용자 결정).
// AI 쪽은 OpenAI·Anthropic 같은 곳의 새 모델 출시와 보안 위협이 맨 앞이다.
// 요약한 소식은 AI가 매긴 등급(summaries.impact)을, 요약 전이거나 등급이 없는 소식은 제목 낱말로 본다.
// 랭킹은 요약 전에 먼저 돌아서(어느 묶음을 요약할지 고른다) 제목 판정이 있어야 큰 소식이 요약 차례에 든다.

export const IMPACTS = ['major', 'notable', 'routine'] as const;
/** major: 일·돈·안전에 바로 영향을 주거나 판도를 바꾸는 소식 · notable: 새로 나오거나 바뀌는 것이 있는 소식 · routine: 전망·의견·후기처럼 바뀌는 게 없는 소식 */
export type Impact = (typeof IMPACTS)[number];

export const isImpact = (x: unknown): x is Impact => typeof x === 'string' && (IMPACTS as readonly string[]).includes(x);

/** 무게별 점수 배수. 한국어 출처 배수(×2, quality.ts)를 넘어야 해외에서 먼저 나온 큰 소식이 앞선다 */
export const IMPACT_BOOST: Record<Impact, number> = { major: 3, notable: 1.5, routine: 1 };

/** 큰 소식을 하루 소식 맨 앞에 먼저 놓는 기간(묶음이 처음 보인 때부터). 지나면 배수만 남는다 */
export const MAJOR_FIRST_HOURS = 48;

// AI만 만드는 곳은 '모델'만 나와도 AI 모델이다. 큰 기술 회사는 휴대폰·차 모델일 수 있어 'AI 모델'처럼 AI가 붙어야 한다
const AI_LAB = /(openai|오픈\s?ai|anthropic|앤트로픽|앤스로픽|deepmind|딥마인드|\bxai\b|mistral|미스트랄|deepseek|딥시크|moonshot|문샷|upstage|업스테이지|lg\s?ai)/i;
const BIG_TECH = /(google|구글|\bmeta\b|메타|microsoft|마이크로소프트|nvidia|엔비디아|alibaba|알리바바|amazon|아마존|apple|애플|samsung|삼성|naver|네이버|kakao|카카오)/i;
const MODEL_WORD = /(모델|\bmodels?\b|\bllms?\b)/i;
const AI_MODEL_WORD = /((ai|인공지능|언어|추론|생성형|파운데이션|오픈\s?소스)\s?모델|\bllms?\b|\b(ai|language|reasoning|frontier|foundation|open-weight|open-source) models?\b)/i;
// 이름만 봐도 AI 모델인 것(버전이 붙은 이름)
const MODEL_NAME = /(\bgpt-?\d|\bo\d(-mini|-pro)?\b|claude\s?(opus|sonnet|haiku|\d)|\b(opus|sonnet|haiku)\s?\d|클로드\s?(오퍼스|소네트|하이쿠|\d)|(오퍼스|소네트|하이쿠)\s?\d|gemini\s?\d|제미나이\s?\d|\bllama\s?\d|라마\s?\d|\bgrok\s?\d|그록\s?\d|deepseek[-\s]?[vr]\d|딥시크[-\s]?[vr]\d|\bqwen\s?\d|큐웬\s?\d|\bkimi\s?k?\d|exaone\s?\d|엑사원\s?\d|hyperclova|하이퍼클로바|\bsora\s?\d|\bveo\s?\d)/i;
const RELEASE = /(출시|공개|발표|선보|내놓|내놨|릴리스|등장|\blaunch(es|ed)?\b|\breleas(e|es|ed)\b|\bintroduc(es|ed|ing)\b|\bunveil(s|ed)?\b|\bannounc(es|ed)\b|\bdebut(s|ed)?\b|\brolls? out\b|\bnow available\b)/i;
const NOT_YET = /(예정|임박|루머|전망|\brumou?rs?\b)/i;

const SECURITY_KO = /(취약점|제로데이|랜섬웨어|악성\s?(코드|앱|프로그램)|멀웨어|해킹|해커|사이버\s?공격|디도스|백도어|공급망\s?공격|피싱|스미싱|침해\s?사고|보안\s?(사고|위협|경고)|(개인\s?정보|정보|데이터|고객|회원|계정|기밀|소스\s?코드)\s?(유출|탈취)|\bcve-\d{4})/i;
const SECURITY_EN = /\b(vulnerabilit(y|ies)|zero-?days?|0-day|ransomware|malware|spyware|backdoors?|hack(ed|ers?)?|breach(es|ed)?|data leaks?|exploit(s|ed)?|supply[- ]chain attacks?|phishing|cyber-?attacks?|ddos|prompt injection|compromised)\b/i;
const NOT_SECURITY = /(해커톤|해킹\s?대회|그로스\s?해킹|\bhackathons?\b|\bhack ?(days?|weeks?)\b|\bgrowth hack|\blife ?hacks?\b)/i;

/** 새 AI 모델 출시 소식인지(제목만 본다) */
export function isAiModelRelease(title: string): boolean {
  if (!RELEASE.test(title) || NOT_YET.test(title)) return false;
  return MODEL_NAME.test(title) || (AI_LAB.test(title) && MODEL_WORD.test(title)) || (BIG_TECH.test(title) && AI_MODEL_WORD.test(title));
}

/** 보안 위협 소식인지(취약점·해킹·유출·악성코드, 제목만 본다) */
export function isSecurityThreat(title: string): boolean {
  return !NOT_SECURITY.test(title) && (SECURITY_KO.test(title) || SECURITY_EN.test(title));
}

/** 제목으로 본 무게: 새 AI 모델 출시·보안 위협이면 major, 아니면 모른다(null) */
export function titleImpact(title: string | null | undefined): Impact | null {
  if (!title) return null;
  return isAiModelRelease(title) || isSecurityThreat(title) ? 'major' : null;
}

/** 소식의 무게. AI가 매긴 등급이 있으면 그것을, 없으면 제목으로 본다. 둘 다 없으면 null(배수 1) */
export function impactOf(c: { impact?: Impact | null; title?: string | null }): Impact | null {
  return c.impact ?? titleImpact(c.title);
}

export function impactBoost(impact: Impact | null): number {
  return impact ? IMPACT_BOOST[impact] : 1;
}
