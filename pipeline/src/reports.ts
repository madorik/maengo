import { GEMINI_MODELS } from '@maengo/core/ai';
import { isCategory } from '@maengo/core/categories';
import { contextFacts, personalOn, type UserContext } from '@maengo/core/context';
import { isImpact, type Impact } from '@maengo/core/feed';
import { geminiChatJson } from '@maengo/core/gemini';
import { addDays, kstDate } from '@maengo/core/kst';
import {
  cleanDigest, DIGEST_MAX_ITEMS, DIGEST_SCHEMA, DIGEST_SYSTEM, digestPrompt, dueReports, periodEnd, pickDigestItems, prevStart, REPORT_MIN_ITEMS,
  reportPushTitle, reportRange, reportTitle, type DigestItem, type ReportCounts, type ReportData, type ReportDigest, type ReportGroup, type ReportPeriod,
} from '@maengo/core/report';
import { groupOf, isLinkTopicId, TOPIC_BY_ID } from '@maengo/core/topics';
import { aiBlockedReason } from './lib/ai-guard';
import { check, db, selectAll } from './lib/db';
import { env } from './lib/env';
import { pushToUser } from './lib/push';
import { flushUsage, recordUsage } from './lib/usage';

// 주간 리포트 만들기(2026-11-10, Premium. 월간은 뺐다). 규칙은 맹고-문서/리포트.md, 기간 셈·AI 정리 규칙은 packages/core/src/report.ts.
// - 서버 스케줄러 작업 reports(하루 한 번 08:00 KST)가 runReports를 부른다: 다 끝난 지난주(1~7일이면 지난달도) 리포트가 없는
//   Premium 회원 것을 만들고, 새로 만든 사람에게 푸시를 한 번(지난달이 같이 나왔으면 지난달 쪽으로) 보낸다.
// - 리포트 화면에서 Premium이 '지금 만들기'를 누르면 웹이 buildReport를 바로 부른다(apps/web/app/api/report/route.ts). 푸시는 없다.
// 숫자는 DB에서 세고, 총평·분야별 정리·떠오른 키워드·맞춤 체크·다음 주 지켜볼 것만 Gemini 한 번(gemini-3.1-flash-lite, 주간 약 ₩5)으로 만든다.
// 맞춤 체크는 회원이 알려 준 내 맞춤 정보(user_context) 문장으로. 설정에서 맞춤 인사이트를 껐으면 보내지 않는다(2026-11-11).
// 정리를 못 만들면(오류·지출 상한) 저장하지 않는다: 다음 날 작업이나 화면에서 다시 만든다.

const KST = '+09:00';
/** 리포트 하나를 만들 시간(정리 호출 30초 + 읽기). 남은 시간이 이보다 적으면 다음 실행에 넘긴다 */
const BUILD_MS = 45_000;
const DIGEST_TIMEOUT_MS = 30_000;
/** 놓친 주요 소식 최대 개수 */
const MISSED_MAX = 3;

/** 정리를 부를 수 없다(지출 상한·크레딧). 작업은 오늘 그만둔다 */
export class ReportAiBlocked extends Error {}

type FeedRow = { date: string; rank: number; cluster_id: number; topic_id: string };
type ReadRow = { cluster_id: number; read_at: string | null; listened_at: string | null; starred: boolean };
type SummaryRow = { cluster_id: number; title: string; short: string; category: string; impact: string | null };

/** 기간에 받은 소식(그날 보여 준 것만, feed_days.visible). 같은 소식은 처음 받은 줄 하나 */
async function receivedIn(userId: string, from: string, to: string): Promise<FeedRow[]> {
  const [feeds, days] = await Promise.all([
    selectAll<FeedRow>((f, t) =>
      db.from('feeds').select('date,rank,cluster_id,topic_id').eq('user_id', userId).gte('date', from).lte('date', to).order('date').order('rank').range(f, t),
    ),
    selectAll<{ date: string; visible: number }>((f, t) => db.from('feed_days').select('date,visible').eq('user_id', userId).gte('date', from).lte('date', to).range(f, t)),
  ]);
  const visible = new Map(days.map((d) => [d.date, d.visible]));
  const seenOnDay = new Map<string, number>();
  const seen = new Set<number>();
  const out: FeedRow[] = [];
  for (const f of feeds) {
    const n = (seenOnDay.get(f.date) ?? 0) + 1;
    seenOnDay.set(f.date, n);
    if (n > (visible.get(f.date) ?? 0) || seen.has(f.cluster_id)) continue;
    seen.add(f.cluster_id);
    out.push(f);
  }
  return out;
}

async function inIds<T>(ids: number[], read: (chunk: number[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(check(await read(ids.slice(i, i + 200)), what) as T[]));
  return out;
}

const readsOf = (userId: string, ids: number[]) =>
  inIds<ReadRow>(ids, (c) => db.from('reads').select('cluster_id,read_at,listened_at,starred').eq('user_id', userId).in('cluster_id', c), 'reads');

/** 내 관심 링크(사이트·채널마다 's-…')는 한 분야로 묶는다 */
const LINKS_GROUP = { id: 'links', name: '내 관심 링크' };

/** 상세 관심사는 큰 분류로, 내 관심 링크는 하나로 묶는다. 내 키워드·뉴스 분야는 그대로 */
const groupIdOf = (topicId: string) => (isLinkTopicId(topicId) ? LINKS_GROUP.id : TOPIC_BY_ID.has(topicId) ? groupOf(topicId) : topicId);

function countsOf(rows: FeedRow[], reads: Map<number, ReadRow>): ReportCounts {
  const c: ReportCounts = { received: rows.length, consumed: 0, listened: 0, bookmarked: 0 };
  for (const f of rows) {
    const r = reads.get(f.cluster_id);
    if (!r) continue;
    if (r.read_at || r.listened_at) c.consumed++;
    if (r.listened_at) c.listened++;
    if (r.starred) c.bookmarked++;
  }
  return c;
}

const consumed = (r: ReadRow | undefined) => !!(r && (r.read_at || r.listened_at));

/** 토픽 이름. 사전에 없는 것(내 키워드·내 관심 링크)은 DB에서 */
async function topicNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>([[LINKS_GROUP.id, LINKS_GROUP.name]]);
  const unknown: string[] = [];
  for (const id of new Set(ids)) {
    const t = TOPIC_BY_ID.get(id);
    if (t) out.set(id, t.name);
    else if (id === LINKS_GROUP.id) continue;
    else unknown.push(id);
  }
  if (unknown.length) for (const r of check(await db.from('topics').select('id,name').in('id', unknown), 'topics') as { id: string; name: string }[]) out.set(r.id, r.name);
  return out;
}

export type BuildResult = { status: 'ready'; headline: string } | { status: 'empty' } | { status: 'exists' };

/**
 * 한 사람·한 기간의 리포트를 만들어 저장한다. 이미 있으면 'exists'(두 실행이 겹쳐도 먼저 넣은 쪽을 둔다).
 * 받은 소식이 REPORT_MIN_ITEMS보다 적으면 'empty'로 저장한다(다시 만들지 않는다).
 * 정리를 못 만들면 던진다(저장하지 않는다). 지출 상한·크레딧으로 막혔으면 ReportAiBlocked
 */
export async function buildReport(userId: string, period: ReportPeriod, start: string): Promise<BuildResult> {
  const key = { user_id: userId, period, start_date: start };
  const exists = check(await db.from('reports').select('status').match(key).maybeSingle(), 'reports exists');
  if (exists) return { status: 'exists' };
  const end = periodEnd(period, start);
  const report = await composeReport(userId, period, start);
  if (!report) {
    check(await db.from('reports').upsert({ ...key, end_date: end, status: 'empty', data: {} }, { onConflict: 'user_id,period,start_date', ignoreDuplicates: true }), 'reports empty');
    return { status: 'empty' };
  }
  const saved = check(
    await db.from('reports').upsert({ ...key, end_date: end, status: 'ready', data: report }, { onConflict: 'user_id,period,start_date', ignoreDuplicates: true }).select('user_id'),
    'reports save',
  ) as unknown[];
  return saved.length ? { status: 'ready', headline: report.digest.headline } : { status: 'exists' };
}

/**
 * 리포트 내용을 만든다(저장하지 않는다. 시험할 때도 이것만 부른다). 받은 소식이 너무 적으면 null.
 * 정리를 못 만들면 던진다
 */
export async function composeReport(userId: string, period: ReportPeriod, start: string): Promise<ReportData | null> {
  const end = periodEnd(period, start);
  const rows = await receivedIn(userId, start, end);
  if (rows.length < REPORT_MIN_ITEMS) return null;

  const pStart = prevStart(period, start);
  const ids = rows.map((r) => r.cluster_id);
  const [reads, summaries, prevRows, topicRows, personal] = await Promise.all([
    readsOf(userId, ids),
    inIds<SummaryRow>(ids, (c) => db.from('summaries').select('cluster_id,title,short,category,impact').eq('tier', 'basic').in('cluster_id', c), 'summaries'),
    receivedIn(userId, pStart, periodEnd(period, pStart)),
    // 이 기간에 넣은 관심사(온보딩에서 고른 것은 빼고)
    db
      .from('user_topics')
      .select('topic_id,created_at,source')
      .eq('user_id', userId)
      .gt('weight', 0)
      .neq('source', 'onboarding')
      .gte('created_at', `${start}T00:00:00${KST}`)
      .lt('created_at', `${addDays(end, 1)}T00:00:00${KST}`)
      .then((r) => check(r, 'user_topics added') as { topic_id: string }[]),
    factsOf(userId),
  ]);
  const readBy = new Map(reads.map((r) => [r.cluster_id, r]));
  const prevReads = new Map((await readsOf(userId, prevRows.map((r) => r.cluster_id))).map((r) => [r.cluster_id, r]));
  const summaryBy = new Map(summaries.map((s) => [s.cluster_id, s]));

  // 분야별 받은·읽은 수(받은 수 많은 순). 앞 기간 읽은 수도 같은 묶음으로
  const added = topicRows.map((t) => t.topic_id).filter((id) => !isLinkTopicId(id));
  const names = await topicNames([...rows.map((r) => groupIdOf(r.topic_id)), ...added]);
  const groupMap = new Map<string, ReportGroup>();
  for (const f of rows) {
    const id = groupIdOf(f.topic_id);
    const g = groupMap.get(id) ?? groupMap.set(id, { id, name: names.get(id) ?? id, received: 0, consumed: 0, prevConsumed: 0 }).get(id)!;
    g.received++;
    if (consumed(readBy.get(f.cluster_id))) g.consumed++;
  }
  for (const f of prevRows) {
    const g = groupMap.get(groupIdOf(f.topic_id));
    if (g && consumed(prevReads.get(f.cluster_id))) g.prevConsumed++;
  }
  const groups = [...groupMap.values()].sort((a, b) => b.received - a.received || b.consumed - a.consumed);

  // 정리에 넘길 소식(요약이 있는 것만)
  const nameOfGroup = new Map(groups.map((g) => [g.id, g.name]));
  const digestItems: DigestItem[] = [];
  for (const f of rows) {
    const s = summaryBy.get(f.cluster_id);
    if (!s) continue;
    digestItems.push({
      id: f.cluster_id,
      group: nameOfGroup.get(groupIdOf(f.topic_id))!,
      title: s.title,
      short: s.short,
      consumed: consumed(readBy.get(f.cluster_id)),
      impact: isImpact(s.impact) ? s.impact : null,
    });
  }
  const digest = await makeDigest(period, start, groups.map((g) => g.name), digestItems, personal);

  // 놓친 주요 소식: 무게가 큰(major → notable) 소식 중 읽지도 듣지도 않은 것, 늦게 받은 것부터
  const weight = (i: Impact | null) => (i === 'major' ? 0 : i === 'notable' ? 1 : 9);
  const missed = digestItems
    .map((i, at) => ({ i, at }))
    .filter(({ i }) => !i.consumed && weight(i.impact) < 9)
    .sort((a, b) => weight(a.i.impact) - weight(b.i.impact) || b.at - a.at)
    .slice(0, MISSED_MAX)
    .map(({ i }) => i.id);

  const items: ReportData['items'] = {};
  for (const id of [
    ...digest.sections.flatMap((s) => s.ids),
    ...digest.keywords.flatMap((k) => k.ids),
    ...(digest.personal ?? []).flatMap((x) => x.ids),
    ...(digest.next ?? []).flatMap((x) => x.ids),
    ...missed,
  ]) {
    const s = summaryBy.get(id);
    if (s) items[id] = { title: s.title, category: isCategory(s.category) ? s.category : 'etc' };
  }

  const prev = countsOf(prevRows, prevReads);
  return {
    v: 1,
    counts: countsOf(rows, readBy),
    prev: prev.received ? prev : null,
    groups,
    added: added.map((id) => ({ id, name: names.get(id) ?? id })),
    digest,
    missed,
    items,
  };
}

/**
 * 회원 정보를 정리에 쓸지(설정 '맞춤 인사이트')와 회원이 알려 준 사정 문장(내 맞춤 정보).
 * 끄면 사정도, 읽거나 들었다는 표시(✓)도 보내지 않는다(개인정보 처리방침 5조). 못 읽으면 끈 것처럼
 */
async function factsOf(userId: string): Promise<{ on: boolean; facts: string[] }> {
  const { data, error } = await db.from('user_context').select('key,value,updated_at').eq('user_id', userId);
  if (error) {
    console.error('[reports] 내 맞춤 정보 읽기 실패', error.message);
    return { on: false, facts: [] };
  }
  const ctx: UserContext = Object.fromEntries((data as { key: string; value: string; updated_at: string }[]).map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
  return personalOn(ctx) ? { on: true, facts: contextFacts(ctx) } : { on: false, facts: [] };
}

/** 로컬 개발 확인용(REPORT_LOCAL_DIGEST=1, 운영 빌드에서는 무시): Gemini 대신 소식 제목으로 만든 정리. 비용 0 */
function localDigest(groups: string[], items: DigestItem[]): ReportDigest {
  const byGroup = groups.map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);
  return {
    headline: `${byGroup[0]?.g ?? '관심 분야'} 소식을 가장 많이 받았어요`,
    sections: byGroup.slice(0, 4).map(({ g, list }) => ({ group: g, summary: `${list.slice(0, 2).map((i) => i.title).join('. ')}.`, ids: list.slice(0, 3).map((i) => i.id) })),
    keywords: [],
    personal: [],
    next: [],
  };
}

/** Gemini 한 번으로 총평·분야별 정리·떠오른 키워드. 못 만들면 던진다 */
async function makeDigest(period: ReportPeriod, start: string, groups: string[], items: DigestItem[], { on, facts }: { on: boolean; facts: string[] }) {
  if (process.env.NODE_ENV !== 'production' && process.env.REPORT_LOCAL_DIGEST === '1') {
    return localDigest(groups, pickDigestItems(items, groups, DIGEST_MAX_ITEMS[period]));
  }
  const blocked = await aiBlockedReason();
  if (blocked) throw new ReportAiBlocked(blocked.note);
  const picked = pickDigestItems(items, groups, DIGEST_MAX_ITEMS[period]);
  // 맞춤 인사이트를 껐으면 읽거나 들었다는 표시(✓)도 보내지 않는다(고르는 건 여기서 이미 했다)
  const sent = on ? picked : picked.map((i) => ({ ...i, consumed: false }));
  const prompt = digestPrompt(`${reportTitle(period, start)} (${reportRange(period, start)})`, groups, sent, 90, facts);
  try {
    const raw = await geminiChatJson<unknown>({
      apiKey: env.geminiKey,
      model: GEMINI_MODELS.report,
      kind: 'report',
      system: `${DIGEST_SYSTEM}\n\n${prompt}`,
      turns: [{ role: 'user', text: '이 기간 리포트 정리' }],
      schema: DIGEST_SCHEMA,
      timeoutMs: DIGEST_TIMEOUT_MS,
      onUsage: recordUsage,
    });
    // 맞춤 체크의 근거: 알려 준 사정이나 읽거나 들은 소식(✓). 맞춤 인사이트를 껐으면 둘 다 보내지 않아 근거가 없다
    const basis = facts.length > 0 || sent.some((i) => i.consumed);
    const digest = cleanDigest(
      raw,
      groups,
      picked.map((i) => i.id),
      basis,
    );
    if (!digest) throw new Error('리포트 정리 모양이 맞지 않음');
    // 사정이 있는데 맞춤 체크가 비면 왜 비었는지 남긴다(모델이 안 줬는지, 걸렀는지)
    if (basis && !digest.personal?.length) {
      const got = (raw as { personal?: { title?: unknown; text?: unknown }[] } | null)?.personal;
      console.warn('[reports] 맞춤 체크 없음', Array.isArray(got) && got.length ? `걸러짐 ${got.length}개: ${got.map((x) => `${String(x?.title ?? '')} / ${String(x?.text ?? '')}`.slice(0, 120)).join(' | ')}` : '모델이 빈 배열');
    }
    return digest;
  } finally {
    await flushUsage();
  }
}

export interface ReportsRun {
  stats: { users: number; ready: number; empty: number; failed: number; pushed: number; later: number; blocked: number };
  unfinished: boolean;
}

/**
 * 서버 스케줄러 작업 reports(하루 한 번 08:00 KST). 오늘 만들 기간(dueReports) 중 아직 없는 리포트를 Premium(기한 안) 회원마다 만들고,
 * 새로 만든 사람에게 푸시 한 번(알림을 켠 사람만). 시간이 모자라면 unfinished로 알려 다음 실행(5분 뒤)이 잇는다.
 * 정리를 못 만든 사람은 오늘은 두고 다음 날 다시(그 사이 화면에서 만들 수도 있다). 지출 상한에 닿으면 오늘은 그만둔다
 */
export async function runReports(now = new Date(), deadline = now.getTime() + 240_000): Promise<ReportsRun> {
  const due = dueReports(kstDate(now));
  const stats: ReportsRun['stats'] = { users: 0, ready: 0, empty: 0, failed: 0, pushed: 0, later: 0, blocked: 0 };
  const users = (
    check(
      await db.from('profiles').select('id,push_enabled,premium_until,created_at').eq('plan', 'plus').not('onboarded_at', 'is', null),
      'profiles plus',
    ) as { id: string; push_enabled: boolean; premium_until: string | null; created_at: string }[]
  ).filter((u) => !u.premium_until || Date.parse(u.premium_until) > now.getTime());
  if (!users.length) return { stats, unfinished: false };

  const have = new Set(
    (
      check(
        await db
          .from('reports')
          .select('user_id,period,start_date')
          .in('user_id', users.map((u) => u.id))
          .in('start_date', [...new Set(due.map((d) => d.start))]),
        'reports have',
      ) as { user_id: string; period: string; start_date: string }[]
    ).map((r) => `${r.user_id}|${r.period}|${r.start_date}`),
  );

  let unfinished = false;
  outer: for (const [n, u] of users.entries()) {
    // 기간이 끝난 뒤에 가입한 사람은 그 기간 리포트가 없다
    const todo = due.filter((d) => !have.has(`${u.id}|${d.period}|${d.start}`) && kstDate(new Date(u.created_at)) <= periodEnd(d.period, d.start));
    if (!todo.length) continue;
    if (deadline - Date.now() < BUILD_MS * todo.length) {
      stats.later += users.length - n;
      unfinished = true;
      break;
    }
    stats.users++;
    const built: { period: ReportPeriod; start: string; headline: string }[] = [];
    for (const d of todo) {
      try {
        const r = await buildReport(u.id, d.period, d.start);
        if (r.status === 'ready') {
          stats.ready++;
          built.push({ ...d, headline: r.headline });
        } else if (r.status === 'empty') stats.empty++;
      } catch (e) {
        if (e instanceof ReportAiBlocked) {
          stats.blocked++;
          console.error('[reports] 정리를 부를 수 없어 오늘은 그만둠', e.message);
          break outer;
        }
        stats.failed++;
        console.error(`[reports] 만들기 실패 ${u.id.slice(0, 8)} ${d.period} ${d.start}: ${String((e as Error).message ?? e).slice(0, 200)}`);
      }
    }
    if (built.length) {
      if (await notify(u.id, u.push_enabled, built)) stats.pushed++;
    }
  }
  if (stats.users || stats.later) console.log('[reports]', JSON.stringify({ ...stats, unfinished }));
  return { stats, unfinished };
}

/** 새로 만든 리포트 알림 한 번. 결과는 그 리포트 줄에 적는다. 보냈으면 true */
async function notify(userId: string, pushEnabled: boolean, built: { period: ReportPeriod; start: string; headline: string }[]): Promise<boolean> {
  const main = built[0]!;
  let result = 'muted';
  if (pushEnabled) {
    try {
      const r = await pushToUser(userId, {
        title: reportPushTitle(main.period, main.start),
        body: main.headline,
        path: `/report?d=${main.start}&from=push`,
      });
      result = 'note' in r ? `${r.status}: ${r.note}` : r.status;
    } catch (e) {
      result = `error: ${String((e as Error).message ?? e)}`;
    }
  }
  for (const b of built) {
    const { error } = await db.from('reports').update({ push_result: result.slice(0, 200) }).match({ user_id: userId, period: b.period, start_date: b.start });
    if (error) console.error('[reports] 알림 결과 기록', error.message);
  }
  return result === 'sent';
}
