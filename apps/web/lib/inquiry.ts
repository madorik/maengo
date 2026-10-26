// 문의하기 양식(/contact)의 종류·한도·검사(서버·화면 공용). 보내기는 lib/server/inquiry.ts

export const INQUIRY_CATEGORIES = [
  { id: 'billing', label: '결제·환불' },
  { id: 'bug', label: '오류 신고' },
  { id: 'idea', label: '기능 제안' },
  { id: 'other', label: '기타' },
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number]['id'];

export const INQUIRY_BODY_MIN = 5;
export const INQUIRY_BODY_MAX = 2000;
/** 로그인한 회원이 하루(한국 시간)에 보낼 수 있는 문의 */
export const INQUIRY_DAILY_PER_USER = 5;
/** 로그인하지 않은 사람이 같은 곳(IP)에서 한 시간에 보낼 수 있는 문의, 하루 전체 */
export const INQUIRY_HOURLY_PER_IP = 3;
export const INQUIRY_DAILY_GUESTS = 50;

export const categoryLabel = (id: string) => INQUIRY_CATEGORIES.find((c) => c.id === id)?.label ?? '기타';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InquiryInput = { category: InquiryCategory; body: string; replyTo: string };

/** 양식 값 검사. 틀리면 화면에 보일 오류 문구 */
export function parseInquiry(raw: { category: unknown; body: unknown; replyTo: unknown }): { ok: true; value: InquiryInput } | { ok: false; error: string } {
  const category = INQUIRY_CATEGORIES.find((c) => c.id === raw.category)?.id;
  if (!category) return { ok: false, error: '문의 종류를 골라 주세요.' };
  const body = typeof raw.body === 'string' ? raw.body.trim() : '';
  if (body.length < INQUIRY_BODY_MIN) return { ok: false, error: '내용을 조금 더 적어 주세요.' };
  if (body.length > INQUIRY_BODY_MAX) return { ok: false, error: `내용은 ${INQUIRY_BODY_MAX.toLocaleString('ko-KR')}자까지 보낼 수 있어요.` };
  const replyTo = typeof raw.replyTo === 'string' ? raw.replyTo.trim() : '';
  if (!EMAIL.test(replyTo) || replyTo.length > 254) return { ok: false, error: '답장 받을 메일 주소를 확인해 주세요.' };
  return { ok: true, value: { category, body, replyTo } };
}

/** 운영자에게 가는 메일 제목: [맹고 문의·결제·환불] 첫 줄 앞부분 */
export function inquirySubject(category: string, body: string): string {
  const first = body.split('\n').find((l) => l.trim())?.trim() ?? '';
  return `[맹고 문의·${categoryLabel(category)}] ${first.length > 40 ? `${first.slice(0, 40)}…` : first}`;
}

export const INQUIRY_REPLY_MAX = 5000;

export type InquiryStatus = 'open' | 'replied' | 'closed';
export const STATUS_LABEL: Record<InquiryStatus, string> = { open: '답장 대기', replied: '답장 완료', closed: '닫음' };

/** '10월 24일'(한국 시간) */
const kstDay = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

/** 회원에게 가는 답장 제목: [맹고] 문의에 답드려요: 첫 줄 앞부분 */
export function replySubject(body: string): string {
  const first = body.split('\n').find((l) => l.trim())?.trim() ?? '';
  return `[맹고] 문의에 답드려요: ${first.length > 30 ? `${first.slice(0, 30)}…` : first}`;
}

/** 회원에게 가는 답장 본문: 답장 + 보낸 문의 인용 + 답장하면 어디로 가는지 */
export function replyText(reply: string, original: { body: string; category: string; createdAt: string }, appUrl: string): string {
  const quoted = original.body
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  return [
    reply.trim(),
    '',
    '──────────',
    `보내 주신 문의(${kstDay(original.createdAt)}, ${categoryLabel(original.category)})`,
    quoted,
    '',
    '이 메일에 회신하시면 맹고 운영자에게 전달됩니다.',
    `와타랩스 맹고 · ${appUrl}`,
  ].join('\n');
}

// ---- 답장 틀(2026-10-26 사용자 지정): 첫 인사와 맺음말은 늘 같고, 가운데 본문만 AI가 쓰거나 운영자가 고친다 ----

export const REPLY_OPENING = '안녕하세요. 와타랩스 맹고입니다.\n문의하신 내용에 답변드립니다.';
export const REPLY_CLOSING = '감사합니다.';

/** AI가 인사·맺음말까지 써 왔으면 떼어 낸다(틀이 두 번 붙지 않게) */
export function stripReplyFrame(answer: string): string {
  return answer
    .trim()
    .replace(/^안녕하세요[.!]?\s*(와타랩스\s*)?맹고입니다[.!]?\s*/, '')
    .replace(/^문의하신 내용에 답변드립니다[.!]?\s*/, '')
    .replace(/(^|\n)\s*감사합니다[.!]?$/, '')
    .trim();
}

/** 보낼 답장 전체: 첫 인사 + 본문 + 맺음말. 본문이 비면 운영자가 채울 빈 줄만 */
export function framedReply(answer: string): string {
  return `${REPLY_OPENING}\n\n${stripReplyFrame(answer)}\n\n${REPLY_CLOSING}`;
}

/** 문장마다 줄을 바꾼다('~다.', '~요.', '~까?' 뒤). 빈 줄로 나눈 문단은 그대로 둔다(숫자 3.8·주소 watalabs.com은 건드리지 않는다) */
export function lineBreakSentences(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => para.replace(/([다요까죠][.!?])[ \t]+(?=\S)/g, '$1\n').trim())
    .filter(Boolean)
    .join('\n\n');
}
