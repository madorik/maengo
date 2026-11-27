import 'server-only';
import type { BriefingSlot } from '@maengo/core/sections';
import type { BriefingInsight } from './briefing-insight';
import { db } from './db';

// 브리핑 음성(오늘 듣기 맨 앞 챕터, 대본은 lib/briefing-script.ts)이 읽는 오늘의 인사이트.
// 인사이트는 만들지 않고 이미 만든 것만 읽는다(배송의 미리 만들기·오늘 화면이 만든다).
// 인사이트는 회원마다 달라서 음성도 회원마다 브리핑마다 한 번 만든다(재생을 누를 때, 약 300자)

/** 그날 그 브리핑에 만들어 둔 오늘의 인사이트. 없거나 흐름이 비었으면 null */
export async function storedInsight(userId: string, date: string, slot: BriefingSlot): Promise<BriefingInsight | null> {
  const { data, error } = await db.from('briefing_insights').select('data').eq('user_id', userId).eq('date', date).eq('slot', slot).maybeSingle();
  if (error) throw new Error(`briefing_insights: ${error.message}`);
  const insight = data?.data as BriefingInsight | undefined;
  return insight?.flows?.length ? insight : null;
}
