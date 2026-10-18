import { check, db } from './db';
import { env } from './env';
import { fcmReady, sendPush, type PushMessage, type PushResult } from './fcm';
import { mapLimit } from './limit';

// 한 사람의 모든 기기로 푸시를 보낸다(배송 알림, 체험 끝 알림). 그 토큰 문제로 실패한 토큰만 지운다(lib/fcm.ts classifyFcmError).

export type UserPushResult =
  | { status: 'sent' }
  /** 보낼 기기가 없다(토큰 없음·모두 죽은 토큰·FCM 설정 없음) */
  | { status: 'no_device'; note: string }
  /** 잠깐의 실패(429·5xx·인증·네트워크): 잠시 뒤 다시 보내 볼 만하다 */
  | { status: 'retry'; note: string }
  /** 다시 보내도 같은 실패(메시지 모양 등). 토큰은 둔다 */
  | { status: 'error'; note: string };

export async function pushToUser(userId: string, msg: PushMessage): Promise<UserPushResult> {
  const tokens = (check(await db.from('device_tokens').select('token').eq('user_id', userId), 'device_tokens') as { token: string }[]).map((t) => t.token);
  if (!tokens.length) return { status: 'no_device', note: '등록된 기기 없음' };
  if (!fcmReady()) return { status: 'no_device', note: 'FCM 서비스 계정 없음' };
  let thrown = '';
  const results = await mapLimit(tokens, 5, (t) =>
    sendPush(t, msg, env.siteUrl).catch((e): PushResult => {
      // 인증(접근 토큰 받기)·네트워크 실패는 던진다: 잠깐의 실패로 본다
      thrown = String((e as Error).message ?? e).slice(0, 120);
      return 'retry';
    }),
  );
  const dead = tokens.filter((_, i) => results[i] === 'dead');
  if (dead.length) await db.from('device_tokens').delete().in('token', dead);
  if (results.includes('ok')) return { status: 'sent' };
  if (results.includes('retry')) return { status: 'retry', note: thrown || 'FCM 잠깐 실패(429·5xx·인증)' };
  if (results.includes('error')) return { status: 'error', note: 'FCM 발송 실패' };
  return { status: 'no_device', note: '살아 있는 기기 토큰 없음' };
}
