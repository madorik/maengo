import 'server-only';
import { kstDate } from '@maengo/core/kst';
import { db, must } from './db';
import { findFeedItem, markRead } from './feed';
import { entitlements, type Profile } from './profile';

// '이 글 듣기'(소식 하나짜리 음성)를 들을 수 있는지(2026-10-23 사용자 결정: Free도 하루 1개).
// 음성 듣기 플랜(Premium)은 늘 된다. 아니면 plans.daily_listens만큼, 오늘(KST) 처음 듣는 소식을 센다.
// 전에 들은 소식(reads.listened_at이 있음)을 다시 듣는 건 세지 않는다. 음성 파일이 이미 있어서 비용이 없다.
// 세는 기록은 음성 파일을 요청할 때 남긴다(화면이 '들음'을 보내기 전에 다른 소식을 또 열어도 서버가 막게).

export type ListenAccess = 'plan' | 'free' | null;

async function listenedRows(userId: string) {
  return must(await db.from('reads').select('cluster_id,listened_at').eq('user_id', userId).not('listened_at', 'is', null), 'reads listened') as {
    cluster_id: number;
    listened_at: string;
  }[];
}

/** 이 소식을 들을 수 있는지: 'plan'(Premium), 'free'(오늘 무료 몫), null(안 됨) */
export async function itemListenAccess(profile: Profile, clusterId: number): Promise<ListenAccess> {
  const { audio, dailyListens } = entitlements(profile);
  if (audio) return 'plan';
  if (dailyListens <= 0) return null;
  const rows = await listenedRows(profile.id);
  if (rows.some((r) => r.cluster_id === clusterId)) return 'free';
  const today = kstDate();
  const usedToday = rows.filter((r) => kstDate(new Date(r.listened_at)) === today).length;
  return usedToday < dailyListens ? 'free' : null;
}

/** 음성 파일을 열기 전에: 들을 수 있으면 true. Free는 받은 소식일 때만 무료 몫을 쓴 것으로 남긴다(없는 번호로 몫을 쓰지 않게) */
export async function claimItemListen(profile: Profile, clusterId: number): Promise<boolean> {
  const access = await itemListenAccess(profile, clusterId);
  if (access !== 'free') return access === 'plan';
  if (!(await findFeedItem(profile, clusterId))) return false;
  await markRead(profile, clusterId, { listened: true });
  return true;
}
