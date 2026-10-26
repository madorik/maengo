import 'server-only';

// 메일 보내기(Resend REST API, 무료 월 3,000통·하루 100통). RESEND_API_KEY가 없으면 보내지 않는다(문의는 DB에만 남는다).
// 보내는 주소는 Resend에 인증한 도메인(watalabs.com)이어야 한다. 맹고-문서/문의하기.md

const API = 'https://api.resend.com/emails';

export const mailConfigured = () => !!process.env.RESEND_API_KEY?.trim();

/** 보내는 사람. 이름 <주소>. 기본은 맹고 문의 <noreply@watalabs.com> */
export const mailFrom = () => process.env.SUPPORT_MAIL_FROM?.trim() || '맹고 문의 <noreply@watalabs.com>';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  /** 같은 메일을 두 번 보내지 않게(Resend가 24시간 동안 같은 키를 한 번만 보낸다) */
  idempotencyKey?: string;
}

/** 보내고 Resend 메일 id를 돌려준다. 실패하면 예외 */
export async function sendMail(m: Mail): Promise<string> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error('RESEND_API_KEY가 없어요');
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(m.idempotencyKey ? { 'idempotency-key': m.idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: mailFrom(), to: [m.to], subject: m.subject, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { id: string }).id;
}
