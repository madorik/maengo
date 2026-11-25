import { GEMINI_MODELS, OPENAI_MODELS } from '@maengo/core/ai';
import { isCategory } from '@maengo/core/categories';
import { contextFacts, personalOn, type UserContext } from '@maengo/core/context';
import { isImpact, type Impact } from '@maengo/core/feed';
import { geminiChatJson } from '@maengo/core/gemini';
import { addDays, kstDate } from '@maengo/core/kst';
import { marketPromptLine, type ReportMarket } from '@maengo/core/markets';
import { openaiChatJson } from '@maengo/core/openai';
import {
  cleanDigest, DIGEST_MAX_ITEMS, DIGEST_SCHEMA, DIGEST_SYSTEM, digestPrompt, dueReports, periodEnd, pickDigestItems, prevStart, REPORT_MIN_ITEMS,
  reportPushBody, reportPushTitle, reportRange, reportTitle, weekDates, type DigestItem, type ReportCounts, type ReportData, type ReportDigest, type ReportGroup,
  type ReportPeriod, type ReportShare,
} from '@maengo/core/report';
import { REPORT_OPENAI_FROM } from '@maengo/core/site';
import { groupOf, isLinkTopicId, TOPIC_BY_ID } from '@maengo/core/topics';
import { aiBlockedReason } from './lib/ai-guard';
import { check, db, selectAll } from './lib/db';
import { env } from './lib/env';
import { marketsFor } from './lib/markets';
import { pushToUser } from './lib/push';
import { flushUsage, recordOpenAiUsage, recordUsage } from './lib/usage';

// 주간 리포트 만들기(2026-11-10, Premium. 월간은 뺐다). 규칙은 맹고-문서/리포트.md, 기간 셈·AI 정리 규칙은 packages/core/src/report.ts.
// - 서버 스케줄러 작업 reports(하루 한 번 08:00 KST)가 runReports를 부른다: 다 끝난 지난주 리포트가 없는 회원 것을 만들고,
//   새로 만든 사람에게 푸시를 한 번 보낸다. Premium 먼저, Free도 만든다(2026-11-19: Free는 총평·숫자와 맛보기까지만 보여 주고 나머지는 Premium, apps/web/.../report).
//   Free는 그 주(이후)에 앱을 연 사람만 만든다(안 오는 사람 몫의 정리 비용을 쓰지 않게).
//   푸시 본문은 그 사람 맞춤 체크 첫 줄(없으면 놓친 주요 소식, 그것도 없으면 총평, packages/core/src/report.ts reportPushBody).
// - 리포트 화면에서 '지금 만들기'를 누르면 웹이 buildReport를 바로 부른다(apps/web/app/api/report/route.ts). 푸시는 없다.
// 숫자는 DB에서 세고, 총평·분야별 정리·떠오른 키워드·맞춤 체크·다음 주 지켜볼 것만 Gemini 한 번(gemini-3.1-flash-lite, 주간 약 ₩5)으로 만든다.
// 2026-11-25(사용자: 지난주 소식이 경제와 내 관심사에 어떤 영향이었는지, 숫자는 차트로): 맞춤 체크는 관심사마다 부담·긍정·지켜볼 쪽과
// 쪽별 소식 번호(막대)·가까운 시장 지표·다음 주 볼 것까지, 시장 지표는 한국은행 ECOS에서 받아(lib/markets.ts) 같은 호출에 넘기고 왜 움직였는지 한 줄씩 받는다.
// 맞춤 체크는 회원이 알려 준 내 맞춤 정보(user_context) 문장으로. 설정에서 맞춤 인사이트를 껐으면 보내지 않는다(2026-11-11).
// 정리를 못 만들면(오류·지출 상한) 저장하지 않는다: 다음 날 작업이나 화면에서 다시 만든다.

const KST = '+09:00';
/** 리포트 하나를 만들 시간(OpenAI 25초가 안 되면 Gemini 30초 + 읽기). 남은 시간이 이보다 적으면 다음 실행에 넘긴다 */
const BUILD_MS = 60_000;
const DIGEST_TIMEOUT_MS = 30_000;
/** OpenAI는 생각 수준 낮음(기본). 2026-11-25 비교에서 중간은 25초를 넘겨 쓰지 않는다 */
const OPENAI_TIMEOUT_MS = 25_000;

/** 리포트 정리 모델 */
export type ReportAi = 'openai' | 'gemini';

/**
 * 이 리포트를 어느 모델로 정리할지(2026-11-25 사용자 '주간 리포트도 루나로'): 처리방침 시행일(REPORT_OPENAI_FROM, 2026-12-02)부터
 * OpenAI 키가 있으면 gpt-6-luna. 오늘의 흐름과 같은 모델이라 긍정·부담 판단이 어긋나지 않고, Gemini 하루 상한(요약과 같이 씀)에도 안 잡힌다
 */
export const reportAiFor = (now = new Date()): ReportAi => (env.openaiKey && kstDate(now) >= REPORT_OPENAI_FROM ? 'openai' : 'gemini');
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

/** 이 기간에 앱을 연 날(visits). 못 읽으면 null(차트의 '연 날'을 그리지 않는다) */
async function visitsOf(userId: string, from: string, to: string): Promise<string[] | null> {
  const { data, error } = await db.from('visits').select('date').eq('user_id', userId).gte('date', from).lte('date', to);
  if (error) {
    console.error('[reports] 접속한 날 읽기 실패', error.message);
    return null;
  }
  return (data as { date: string }[]).map((r) => r.date);
}

export type BuildResult = { status: 'ready'; headline: string; body: string } | { status: 'empty' } | { status: 'exists' };

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
  return saved.length ? { status: 'ready', headline: report.digest.headline, body: reportPushBody(report) } : { status: 'exists' };
}

/**
 * 리포트 내용을 만든다(저장하지 않는다. 시험할 때도 이것만 부른다). 받은 소식이 너무 적으면 null.
 * 정리를 못 만들면 던진다
 */
export async function composeReport(
  userId: string,
  period: ReportPeriod,
  start: string,
  opts: { ai?: ReportAi; /** 다듬기 전 모델 답(모델 비교·원인 찾기용) */ onRaw?: (raw: unknown, model: string) => void } = {},
): Promise<ReportData | null> {
  const end = periodEnd(period, start);
  const rows = await receivedIn(userId, start, end);
  if (rows.length < REPORT_MIN_ITEMS) return null;

  const pStart = prevStart(period, start);
  const ids = rows.map((r) => r.cluster_id);
  const [reads, summaries, prevRows, topicRows, personal, visits, markets] = await Promise.all([
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
    visitsOf(userId, pStart, end),
    // 지난주 경제(2026-11-25): 앞 주부터 받아 한 주 등락을 견준다. 키가 없거나 못 받으면 빈 배열(지표 칸 없이 만든다)
    marketsFor(pStart, start, end),
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
  const { digest, model } = await makeDigest(period, start, groups.map((g) => g.name), digestItems, personal, markets, opts.ai, opts.onRaw);

  // 놓친 주요 소식: 무게가 큰(major → notable) 소식 중 읽지도 듣지도 않은 것, 늦게 받은 것부터
  const weight = (i: Impact | null) => (i === 'major' ? 0 : i === 'notable' ? 1 : 9);
  const missed = digestItems
    .map((i, at) => ({ i, at }))
    .filter(({ i }) => !i.consumed && weight(i.impact) < 9)
    .sort((a, b) => weight(a.i.impact) - weight(b.i.impact) || b.at - a.at)
    .slice(0, MISSED_MAX)
    .map(({ i }) => i.id);

  // 소식마다 그 기간에 처음 받은 날(지표 선 그래프에 그날을 점으로 찍는다)
  const firstDate = new Map<number, string>();
  for (const r of rows) if (!firstDate.has(r.cluster_id) || r.date < firstDate.get(r.cluster_id)!) firstDate.set(r.cluster_id, r.date);
  const items: ReportData['items'] = {};
  for (const id of [
    ...digest.sections.flatMap((s) => s.ids),
    ...digest.keywords.flatMap((k) => k.ids),
    ...(digest.personal ?? []).flatMap((x) => x.ids),
    ...(digest.next ?? []).flatMap((x) => x.ids),
    ...missed,
  ]) {
    const s = summaryBy.get(id);
    if (s) items[id] = { title: s.title, category: isCategory(s.category) ? s.category : 'etc', ...(firstDate.has(id) ? { date: firstDate.get(id)! } : {}) };
  }

  // 요일별 차트(그날 받은 소식과 그중 본 소식)와 큰 소식을 챙겨 본 정도(2026-11-19)
  const days = weekDates(start).map((date) => {
    const day = rows.filter((r) => r.date === date);
    return { date, received: day.length, consumed: day.filter((r) => consumed(readBy.get(r.cluster_id))).length };
  });
  const share = (w: Impact): ReportShare => {
    const list = digestItems.filter((i) => i.impact === w);
    return { received: list.length, consumed: list.filter((i) => i.consumed).length };
  };
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
    personalized: personal.on,
    days,
    ...(visits ? { openDays: visits.filter((d) => d >= start && d <= end), prevOpenDays: visits.filter((d) => d >= pStart && d < start).length } : {}),
    weight: { major: share('major'), notable: share('notable') },
    ...(markets.length ? { markets } : {}),
    model,
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
function localDigest(groups: string[], items: DigestItem[], markets: ReportMarket[]): ReportDigest {
  const byGroup = groups.map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);
  const ids = items.map((i) => i.id);
  // 화면 확인용 관심사 하나(쪽별 막대·지표 선 그래프가 그려지게). 문구는 제목을 옮긴 것이라 뜻은 없다
  const personal: ReportDigest['personal'] = items[0]
    ? [{
        about: byGroup[0]?.g ?? '관심 분야',
        title: items[0].title.slice(0, 30),
        text: `${items[0].title}. 화면 확인용 정리예요.`,
        ids: [items[0].id],
        tone: 'plus',
        tally: { plus: ids.slice(0, 4), minus: ids.slice(4, 6), watch: ids.slice(6, 7) },
        ...(markets[0] ? { metric: markets[0].key } : {}),
        next: '다음 주 발표 일정 확인',
      }]
    : [];
  return {
    headline: `${byGroup[0]?.g ?? '관심 분야'} 소식을 가장 많이 받았어요`,
    sections: byGroup.slice(0, 4).map(({ g, list }) => ({ group: g, summary: `${list.slice(0, 2).map((i) => i.title).join('. ')}.`, ids: list.slice(0, 3).map((i) => i.id) })),
    keywords: [],
    personal,
    next: [],
    ...(markets.length ? { economy: { headline: '화면 확인용 지난주 경제 한 줄이에요', notes: [] } } : {}),
  };
}

/**
 * 모델 한 번으로 총평·분야별 정리·떠오른 키워드·맞춤 체크(쪽 나누기)·지난주 경제. 못 만들면 던진다.
 * ai를 주지 않으면 reportAiFor로 고르고, OpenAI가 안 되면(키·크레딧·시간 초과·모양) Gemini로 다시 만든다(오늘의 흐름과 같은 방식).
 * ai를 주면 그 모델로만(시험·비교용, 안 되면 던진다)
 */
async function makeDigest(
  period: ReportPeriod,
  start: string,
  groups: string[],
  items: DigestItem[],
  { on, facts }: { on: boolean; facts: string[] },
  markets: ReportMarket[] = [],
  forced?: ReportAi,
  onRaw?: (raw: unknown, model: string) => void,
): Promise<{ digest: ReportDigest; model: string }> {
  if (process.env.NODE_ENV !== 'production' && process.env.REPORT_LOCAL_DIGEST === '1') {
    return { digest: localDigest(groups, pickDigestItems(items, groups, DIGEST_MAX_ITEMS[period]), markets), model: 'local' };
  }
  const picked = pickDigestItems(items, groups, DIGEST_MAX_ITEMS[period]);
  // 맞춤 인사이트를 껐으면 읽거나 들었다는 표시(✓)도 보내지 않는다(고르는 건 여기서 이미 했다)
  const sent = on ? picked : picked.map((i) => ({ ...i, consumed: false }));
  const marketLines = markets.map((m) => marketPromptLine(m, start)).filter((l): l is string => !!l);
  const prompt = digestPrompt(`${reportTitle(period, start)} (${reportRange(period, start)})`, groups, sent, 90, facts, marketLines);
  // 맞춤 체크의 근거: 알려 준 사정이나 읽거나 들은 소식(✓). 맞춤 인사이트를 껐으면 둘 다 보내지 않아 근거가 없다
  const basis = facts.length > 0 || sent.some((i) => i.consumed);
  const clean = (raw: unknown, model: string) => {
    onRaw?.(raw, model);
    const digest = cleanDigest(
      raw,
      groups,
      picked.map((i) => i.id),
      basis,
      markets.map((m) => m.key),
    );
    if (!digest) throw new Error(`리포트 정리 모양이 맞지 않음(${model})`);
    // 사정이 있는데 맞춤 체크가 비면 왜 비었는지 남긴다(모델이 안 줬는지, 걸렀는지)
    if (basis && !digest.personal?.length) {
      const got = (raw as { personal?: { title?: unknown; text?: unknown }[] } | null)?.personal;
      console.warn('[reports] 맞춤 체크 없음', model, Array.isArray(got) && got.length ? `걸러짐 ${got.length}개: ${got.map((x) => `${String(x?.title ?? '')} / ${String(x?.text ?? '')}`.slice(0, 120)).join(' | ')}` : '모델이 빈 배열');
    }
    return { digest, model };
  };

  const ai = forced ?? reportAiFor();
  if (ai === 'openai') {
    const logs: Promise<void>[] = [];
    try {
      if (!env.openaiKey) throw new Error('OpenAI 키 없음');
      const raw = await openaiChatJson<unknown>({
        apiKey: env.openaiKey,
        model: OPENAI_MODELS.report,
        kind: 'report',
        system: DIGEST_SYSTEM,
        user: prompt,
        schema: DIGEST_SCHEMA,
        name: 'weekly_report',
        timeoutMs: OPENAI_TIMEOUT_MS,
        onUsage: (u) => logs.push(recordOpenAiUsage(u)),
      });
      return clean(raw, OPENAI_MODELS.report);
    } catch (e) {
      if (forced) throw e;
      console.warn('[reports] OpenAI 정리 실패, Gemini로 다시', String((e as Error)?.message ?? e).slice(0, 160));
    } finally {
      await Promise.all(logs);
    }
  }

  const blocked = await aiBlockedReason();
  if (blocked) throw new ReportAiBlocked(blocked.note);
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
    return clean(raw, GEMINI_MODELS.report);
  } finally {
    await flushUsage();
  }
}

export interface ReportsRun {
  stats: { users: number; ready: number; empty: number; failed: number; pushed: number; later: number; blocked: number };
  unfinished: boolean;
}

/**
 * 서버 스케줄러 작업 reports(하루 한 번 08:00 KST). 오늘 만들 기간(dueReports) 중 아직 없는 리포트를 회원마다(Premium 먼저, Free도) 만들고,
 * 새로 만든 사람에게 푸시 한 번(알림을 켠 사람만). 시간이 모자라면 unfinished로 알려 다음 실행(5분 뒤)이 잇는다.
 * 정리를 못 만든 사람은 오늘은 두고 다음 날 다시(그 사이 화면에서 만들 수도 있다). 지출 상한에 닿으면 오늘은 그만둔다
 */
export async function runReports(now = new Date(), deadline = now.getTime() + 240_000): Promise<ReportsRun> {
  const due = dueReports(kstDate(now));
  const stats: ReportsRun['stats'] = { users: 0, ready: 0, empty: 0, failed: 0, pushed: 0, later: 0, blocked: 0 };
  // 회원: Premium(기한 안)이 먼저, 그다음 Free. 시간이 모자라 다음 실행으로 넘어가도 낸 사람 몫이 먼저 만들어진다
  const all = await selectAll<{ id: string; push_enabled: boolean; plan: string; premium_until: string | null; created_at: string; last_seen_at: string | null }>((f, t) =>
    db.from('profiles').select('id,push_enabled,plan,premium_until,created_at,last_seen_at').not('onboarded_at', 'is', null).order('id').range(f, t),
  );
  const isPremium = (u: (typeof all)[number]) => u.plan === 'plus' && (!u.premium_until || Date.parse(u.premium_until) > now.getTime());
  const users = [...all.filter(isPremium), ...all.filter((u) => !isPremium(u))];
  if (!users.length) return { stats, unfinished: false };

  // 이미 있는 리포트(회원이 많아도 주소가 길어지지 않게 나눠서 읽는다)
  const have = new Set<string>();
  const starts = [...new Set(due.map((d) => d.start))];
  for (let i = 0; i < users.length; i += 100) {
    const rows = check(
      await db.from('reports').select('user_id,period,start_date').in('user_id', users.slice(i, i + 100).map((u) => u.id)).in('start_date', starts),
      'reports have',
    ) as { user_id: string; period: string; start_date: string }[];
    for (const r of rows) have.add(`${r.user_id}|${r.period}|${r.start_date}`);
  }

  let unfinished = false;
  outer: for (const [n, u] of users.entries()) {
    // 기간이 끝난 뒤에 가입한 사람은 그 기간 리포트가 없다
    // Free는 그 주(이후)에 앱을 연 사람만(last_seen_at). 안 오는 사람 몫의 정리 비용을 쓰지 않는다
    const todo = due.filter(
      (d) =>
        !have.has(`${u.id}|${d.period}|${d.start}`) &&
        kstDate(new Date(u.created_at)) <= periodEnd(d.period, d.start) &&
        (isPremium(u) || (!!u.last_seen_at && kstDate(new Date(u.last_seen_at)) >= d.start)),
    );
    if (!todo.length) continue;
    if (deadline - Date.now() < BUILD_MS * todo.length) {
      stats.later += users.length - n;
      unfinished = true;
      break;
    }
    stats.users++;
    const built: { period: ReportPeriod; start: string; body: string }[] = [];
    for (const d of todo) {
      try {
        const r = await buildReport(u.id, d.period, d.start);
        if (r.status === 'ready') {
          stats.ready++;
          built.push({ ...d, body: r.body });
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

/** 새로 만든 리포트 알림 한 번(본문은 그 사람 맞춤 문구, reportPushBody). 결과는 그 리포트 줄에 적는다. 보냈으면 true */
async function notify(userId: string, pushEnabled: boolean, built: { period: ReportPeriod; start: string; body: string }[]): Promise<boolean> {
  const main = built[0]!;
  let result = 'muted';
  if (pushEnabled) {
    try {
      const r = await pushToUser(userId, {
        title: reportPushTitle(main.period, main.start),
        body: main.body,
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
