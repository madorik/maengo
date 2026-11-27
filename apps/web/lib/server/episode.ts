import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { templateScript } from '@maengo/core/ai';
import { GeminiQuotaError } from '@maengo/core/gemini';
import { estimateTimeline, layoutChapters, SEGMENT_TAIL_MS, withTrailingSilence } from '@maengo/core/audio';
import { kstDate } from '@maengo/core/kst';
import type { BriefingSlot } from '@maengo/core/sections';
import { isLinkTopicId } from '@maengo/core/topics';
import type { Chapter, Persona, ScriptLine, Voice } from '@maengo/core/types';
import { BRIEFING_ID } from '../player/item';
import type { FeedItem } from '../types';
import { basicTts, ttsEngineFor, type TtsEngine } from './ai';
import { TtsQuotaError } from './google-tts';
import { audioStore } from './audio-store';
import { briefingScript, briefingTitle } from '../briefing-script';
import { storedInsight } from './briefing-audio';
import { db, must } from './db';
import { feedItems, findFeedItem, playlistItems, todayFillStatus } from './feed';
import { concatBytes, encodeMp3, mp3DurationMs } from './mp3';
import { blockTts, recordUse, TtsBusyError, ttsBlockedUntil } from './limits';
import { entitlements, type Profile } from './profile';

// 듣기(PLAN.md 8장). 음성은 사용자가 재생을 누를 때만 만든다. 페이지를 열 때는 이미 만든 음성이 있는지만 본다.
// 세그먼트 = 소식 하나 × 말투 × 목소리. 대본 내용 해시로 키를 만들어 같은 대본이면 누가 듣든 다시 만들지 않는다.
// 파일은 MP3로 R2(audio/seg/<key>.mp3)에, 줄별 시각은 audio_segments에 둔다.
// 오늘 전체 듣기는 세그먼트 MP3를 이어 붙인 파일(audio/ep/<hash>.mp3)을 처음 열 때 만든다.
// 오늘 듣기 맨 앞에는 브리핑(오늘의 인사이트 핵심 요약, lib/briefing-script.ts) 세그먼트가 챕터 번호 BRIEFING_ID(0)로 붙는다(2026-11-27).
// 브리핑은 소식이 아니라서 줄별 시각을 audio_segments(소식 번호가 꼭 있어야 하고 쇼츠가 소식 번호로 읽는다)가 아니라 저장소의 audio/seg/<key>.json에 둔다.

interface SegmentLine {
  text: string;
  para?: number;
  startMs: number;
  endMs: number;
}

interface SegmentRow {
  key: string;
  r2_key: string;
  duration_ms: number;
  lines: SegmentLine[];
}

export interface Episode {
  /** 음성이 다 있으면 저장소 키(소식 하나면 세그먼트, 여럿이면 이어 붙인 파일), 아니면 null(챕터는 어림값) */
  objectKey: string | null;
  /** 이어 붙인 파일을 아직 안 만들었으면 만들 재료 */
  parts: string[];
  durationMs: number;
  chapters: Chapter[];
  /** 맨 앞에 브리핑을 붙였으면 그 세그먼트 키(파일 주소에 넣어 브리핑이 바뀌면 새 주소가 되게), 아니면 null */
  briefKey: string | null;
}

/**
 * 세그먼트의 주인. 소식이면 줄별 시각을 audio_segments에, 브리핑이면 저장소의 JSON(audio/seg/<key>.json)에 둔다
 */
type Owner = { kind: 'item'; item: FeedItem } | { kind: 'brief' };

/** 브리핑 세그먼트의 줄별 시각 파일(MP3를 올린 뒤에 올린다: 이 파일이 있으면 MP3도 있다) */
const briefMetaKey = (key: string) => `audio/seg/${key}.json`;

/**
 * 대본·TTS 입력 형식을 바꾸면 올린다(예전 음성을 다시 쓰지 않게). 2: 말투 지시문을 빼고 대본만 읽게 함(2026-10-10)
 * 3: 끝에 무음 1초(SEGMENT_TAIL_MS. 처음 2초였다가 같은 날 1초로, 2초짜리 음성은 만들어지기 전이라 버전은 그대로), 마지막 줄을 why 대신 '정리하면, (제목)이라는 소식이었습니다.'로(2026-10-25)
 * 4: 문장마다가 아니라 문단마다 한 번에 합성, 아나운서 빠르기 1.05 → 1(2026-10-26, google-tts.ts)
 * 5: 문단 음성 앞뒤 무음을 잘라 내고 이음매 쉼을 줄임(2026-10-29, 이음매마다 1초 가까이 비어 뚝뚝 끊겨 들렸다)
 * (안 올림) Premium Gemini를 한 번에서 문단별 동시 합성으로(2026-11-06, core gemini.ts): 목소리·말투가 같아 이미 만든 음성을 그대로 쓴다
 */
const SCRIPT_VERSION = 5;
/** 무료 등급 TTS 분당 한도를 넘지 않게 한 번에 세 개까지만 만든다 */
const TTS_CONCURRENCY = 3;
/** R2 전에 로컬에 WAV(PCM)로 만들어 둔 음성. 있으면 TTS를 다시 부르지 않고 MP3로 옮긴다 */
const LEGACY_DIR = path.join(process.cwd(), '.cache', 'audio');

const g = globalThis as typeof globalThis & {
  __maengoInflight?: Map<string, Promise<SegmentRow>>;
  __maengoTtsQueue?: { running: number; waiting: (() => void)[] };
  __maengoEpisodeBuilds?: Map<string, Promise<void>>;
};
const inflight = (g.__maengoInflight ??= new Map());
const queue = (g.__maengoTtsQueue ??= { running: 0, waiting: [] });
const episodeBuilds = (g.__maengoEpisodeBuilds ??= new Map());

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 24);

/** 8비트(부호 없음) PCM을 16비트(부호 있음, 리틀 엔디언)로 */
function pcm8to16(pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(pcm.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < pcm.length; i++) view.setInt16(i * 2, (pcm[i]! - 128) << 8, true);
  return out;
}

function scriptOf(item: FeedItem): ScriptLine[] {
  return templateScript({ model: '', title: item.title, short: item.short, body: item.body });
}

function segmentKey(lines: ScriptLine[], persona: Persona, voice: Voice, engine: TtsEngine): string {
  // 모델과 목소리 이름(Chirp 3 HD)도 넣어 엔진·목소리를 바꾸면 새로 만든다(Free는 Chirp, Premium은 Gemini라 같은 소식도 따로). Gemini는 voiceId가 undefined라 키에서 빠진다.
  // persona와 vk(예전 대담의 'pair' 자리)는 이미 만든 음성의 키와 같게 이름·순서를 그대로 둔다(바꾸면 해시가 달라져 모든 음성을 다시 만든다)
  return `${persona}-${voice}-${sha(JSON.stringify({ v: SCRIPT_VERSION, model: engine.model, voiceId: engine.voiceId(voice), persona, vk: voice, lines }))}`;
}

async function findSegments(keys: string[]): Promise<Map<string, SegmentRow>> {
  if (!keys.length) return new Map();
  const rows = must(await db.from('audio_segments').select('key,r2_key,duration_ms,lines').in('key', keys), 'audio_segments') as SegmentRow[];
  return new Map(rows.map((r) => [r.key, r]));
}

/** 이미 만든 브리핑 세그먼트(저장소의 줄별 시각 파일). 없으면 null */
async function findBrief(key: string): Promise<SegmentRow | null> {
  const bytes = await audioStore.get(briefMetaKey(key));
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as SegmentRow;
  } catch {
    return null;
  }
}

/** 이 주인의 세그먼트 하나를 찾는다(소식은 audio_segments, 브리핑은 저장소) */
async function findOne(owner: Owner, key: string): Promise<SegmentRow | null> {
  return owner.kind === 'brief' ? findBrief(key) : ((await findSegments([key])).get(key) ?? null);
}

async function withTtsSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (queue.running >= TTS_CONCURRENCY) await new Promise<void>((r) => queue.waiting.push(r));
  queue.running++;
  try {
    return await fn();
  } finally {
    queue.running--;
    queue.waiting.shift()?.();
  }
}

/** 예전 로컬 WAV 캐시가 있으면 꺼낸다(TTS 비용 0) */
async function legacyPcm(key: string): Promise<{ pcm: Uint8Array; sampleRate: number; lines: SegmentLine[] } | null> {
  try {
    const [meta, pcm] = await Promise.all([readFile(path.join(LEGACY_DIR, `${key}.json`), 'utf8'), readFile(path.join(LEGACY_DIR, `${key}.pcm`))]);
    const m = JSON.parse(meta) as { sampleRate: number; lines: SegmentLine[] };
    return { pcm: new Uint8Array(pcm), sampleRate: m.sampleRate, lines: m.lines };
  } catch {
    return null;
  }
}

/** TTS로 만들어(또는 예전 캐시에서 옮겨) MP3로 올리고 행을 남긴다. 같은 키를 동시에 요청하면 한 번만 만든다 */
/** 음성을 만드는 사람(사용량 기록용. Premium 듣기는 횟수 제한이 없다) */
interface Requester {
  /** 회원 없이 만든 음성이면 null(사용량은 사람 없이 남긴다) */
  userId: string | null;
}

const LOCK_STALE_MS = 3 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 이 키의 음성을 만들 권리를 얻는다. 다른 서버가 만들고 있으면 false(오래된 잠금은 넘겨받는다) */
async function acquireLock(key: string): Promise<boolean> {
  const { error } = await db.from('audio_jobs').insert({ key });
  if (!error) return true;
  if (error.code !== '23505') throw new Error(`audio_jobs: ${error.message}`);
  const row = must(await db.from('audio_jobs').select('started_at').eq('key', key).maybeSingle(), 'audio_jobs') as { started_at: string } | null;
  if (row && Date.now() - Date.parse(row.started_at) < LOCK_STALE_MS) return false;
  const { data } = await db.from('audio_jobs').upsert({ key, started_at: new Date().toISOString() }, { onConflict: 'key' }).select('key');
  return !!data?.length;
}

async function releaseLock(key: string) {
  await db.from('audio_jobs').delete().eq('key', key);
}

/** 다른 서버가 만드는 중인 음성을 기다린다(최대 약 3분). 잠금이 풀렸는데 음성이 없으면 null */
async function waitForSegment(owner: Owner, key: string): Promise<SegmentRow | null> {
  for (let waited = 0; waited < LOCK_STALE_MS; waited += 2000) {
    await sleep(2000);
    const row = await findOne(owner, key);
    if (row) return row;
    const { data } = await db.from('audio_jobs').select('key').eq('key', key).maybeSingle();
    if (!data) return null;
  }
  return null;
}

function generateSegment(owner: Owner, persona: Persona, voice: Voice, key: string, lines: ScriptLine[], who: Requester, engine: TtsEngine): Promise<SegmentRow> {
  const running = inflight.get(key);
  if (running) return running;
  const label = owner.kind === 'item' ? `#${owner.item.clusterId}` : '브리핑';
  // 음성을 만든다. 기본 음성이 한도에 걸리면 알려 준 시각까지(모르면 Google은 5분, Gemini는 하루 한도라 한 시간) TTS를 부르지 않는다
  const speak = async (e: TtsEngine) => {
    try {
      return await withTtsSlot(() => e.client.speak({ model: e.model, persona, voice, lines }));
    } catch (err) {
      if (e === basicTts && (err instanceof GeminiQuotaError || err instanceof TtsQuotaError)) {
        const minutes = err.retryMs ? Math.min(24 * 60, Math.ceil(err.retryMs / 60_000)) : err instanceof TtsQuotaError ? 5 : 60;
        await blockTts(minutes);
        throw new TtsBusyError(new Date(Date.now() + minutes * 60_000));
      }
      throw err;
    }
  };
  const job = (async () => {
    const t0 = Date.now();
    let pcm: Uint8Array;
    let sampleRate: number;
    let timed: SegmentLine[];
    let source: string;
    /** 실제로 만든 엔진과 저장할 키(Premium Gemini가 실패해 기본 음성으로 만들면 기본 음성 키) */
    let used = engine;
    let rowKey = key;
    // 잠금을 얻었으면 MP3 변환·업로드·행 저장까지 어디서 실패해도 풀어 준다(안 풀면 다른 요청이 3분 동안 기다린다)
    let locked = false;
    try {
      const legacy = await legacyPcm(key);
      if (legacy) {
        ({ pcm, sampleRate } = legacy);
        timed = legacy.lines;
        source = '예전 캐시에서 옮김';
      } else {
        // 기본 음성의 서비스 한도가 찼으면 부르지 않는다(Premium Gemini는 따로라 막지 않는다)
        const busy = engine === basicTts ? await ttsBlockedUntil() : null;
        if (busy) throw new TtsBusyError(busy);
        // 다른 서버가 같은 음성을 만들고 있으면 기다렸다가 그것을 쓴다(같은 음성을 두 번 만들지 않게)
        if (!(await acquireLock(key))) {
          const done = await waitForSegment(owner, key);
          if (done) return done;
          throw new Error('다른 요청이 이 음성을 만들다 실패했어요');
        }
        locked = true;
        // 잠금을 얻기 직전에 다른 서버가 다 만들었을 수 있다
        const again = await findOne(owner, key);
        if (again) return again;
        let speech;
        try {
          speech = await speak(engine);
        } catch (e) {
          if (engine === basicTts) throw e;
          // Premium(Gemini)이 실패하면 그 소식은 기본 음성으로 들려준다. 기본 음성이 이미 있으면 그것을 쓰고, 없으면 만들어 기본 음성 키로 둔다.
          // Gemini 키 자리는 비워 두어 다음에 들을 때 다시 해 본다
          console.warn(`[tts] ${label} Gemini 실패, 기본 음성으로: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
          used = basicTts;
          rowKey = segmentKey(lines, persona, voice, basicTts);
          const basic = await findOne(owner, rowKey);
          if (basic) return basic;
          speech = await speak(basicTts);
        }
        // 키 없는 로컬 개발의 더미 신호음은 8비트라 16비트로 늘려 MP3로 만든다(운영 음성은 늘 16비트)
        if (speech.bitsPerSample === 8) speech = { ...speech, pcm: pcm8to16(speech.pcm), bitsPerSample: 16 };
        if (speech.bitsPerSample !== 16) throw new Error('16비트 PCM만 MP3로 바꿀 수 있어요');
        pcm = speech.pcm;
        sampleRate = speech.sampleRate;
        timed = lines.map((l, i) => ({ ...l, ...speech.lineTimesMs[i]! }));
        source = 'TTS';
        await recordUse(who.userId, 'voice');
        // 내 관심 링크 소식 음성은 따로도 센다(비용 보기용. 2026-11-08부터 하루 몫 제한은 없다)
        if (owner.kind === 'item' && isLinkTopicId(owner.item.topicId)) await recordUse(who.userId, 'voice_link');
      }
      // 끝에 무음을 붙여 저장한다. 줄 시각은 그대로라 마지막 줄 뒤가 쉼이 된다
      const mp3 = encodeMp3(withTrailingSilence(pcm, sampleRate, 16, SEGMENT_TAIL_MS), sampleRate);
      const r2Key = `audio/seg/${rowKey}.mp3`;
      await audioStore.put(r2Key, mp3, 'audio/mpeg');
      const row: SegmentRow = { key: rowKey, r2_key: r2Key, duration_ms: mp3DurationMs(mp3.length), lines: timed };
      if (owner.kind === 'brief') await audioStore.put(briefMetaKey(rowKey), new TextEncoder().encode(JSON.stringify(row)), 'application/json');
      else
        must(
          await db.from('audio_segments').upsert(
            { ...row, cluster_id: owner.item.clusterId, persona, voice, model: used.model, bytes: mp3.length },
            { onConflict: 'key' },
          ),
          'audio_segments upsert',
        );
      console.log(`[tts] ${label} ${persona}/${voice} ${used.id} ${(row.duration_ms / 1000).toFixed(1)}초 · ${Math.round(mp3.length / 1024)}KB · ${source} · ${((Date.now() - t0) / 1000).toFixed(1)}초 걸림`);
      return row;
    } finally {
      if (locked) await releaseLock(key).catch((e) => console.error('[tts] 잠금 풀기 실패', String((e as Error)?.message ?? e).slice(0, 200)));
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** 에피소드의 한 챕터가 될 재료: 소식 하나, 또는 맨 앞의 브리핑 */
interface Part {
  owner: Owner;
  rank: number;
  clusterId: number;
  title: string;
  lines: ScriptLine[];
}

const itemPart = (item: FeedItem): Part => ({ owner: { kind: 'item', item }, rank: item.rank, clusterId: item.clusterId, title: item.title, lines: scriptOf(item) });

/**
 * 그날 그 브리핑의 오늘의 인사이트로 만든 브리핑 챕터 재료. 인사이트가 아직 없거나(만드는 중·실패) 읽을 흐름이 없으면 null.
 * 인사이트를 못 읽어도 소식 듣기는 그대로 되게 오류는 삼킨다
 */
async function briefingPart(profile: Profile, date: string, slot: BriefingSlot): Promise<Part | null> {
  const insight = await storedInsight(profile.id, date, slot).catch((e: unknown) => {
    console.error('[tts] 브리핑 인사이트 읽기 실패', String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  });
  const lines = insight ? briefingScript(insight, slot) : [];
  if (!lines.length) return null;
  return { owner: { kind: 'brief' }, rank: 0, clusterId: BRIEFING_ID, title: briefingTitle(slot), lines };
}

async function assemble(list: Part[], persona: Persona, voice: Voice, engine: TtsEngine, generate: Requester | null): Promise<Episode> {
  const scripts = list.map((p) => ({ ...p, key: segmentKey(p.lines, persona, voice, engine) }));
  const brief = scripts.find((s) => s.owner.kind === 'brief');
  const [found, briefSeg] = await Promise.all([
    findSegments(scripts.filter((s) => s.owner.kind === 'item').map((s) => s.key)),
    brief ? findBrief(brief.key) : Promise.resolve(null),
  ]);
  const segs = await Promise.all(
    scripts.map(
      async (s) =>
        (s.owner.kind === 'brief' ? briefSeg : found.get(s.key)) ??
        (generate ? generateSegment(s.owner, persona, voice, s.key, s.lines, generate, engine) : null),
    ),
  );
  const parts = scripts.map((s, i) => {
    const seg = segs[i];
    if (seg) return { durationMs: seg.duration_ms, lines: seg.lines };
    const { lineTimesMs, durationMs } = estimateTimeline(s.lines);
    return { durationMs, lines: s.lines.map((l, j) => ({ ...l, ...lineTimesMs[j]! })) };
  });
  const chapters = layoutChapters(
    scripts.map((s, i) => ({ rank: s.rank, clusterId: s.clusterId, title: s.title, durationMs: parts[i]!.durationMs, lines: parts[i]!.lines })),
  );
  const durationMs = chapters.at(-1)?.endMs ?? 0;
  const briefKey = brief?.key ?? null;
  const ready = segs.length > 0 && segs.every((s) => s !== null);
  if (!ready) return { objectKey: null, parts: [], durationMs, chapters, briefKey };
  const keys = (segs as SegmentRow[]).map((s) => s.r2_key);
  const objectKey = keys.length === 1 ? keys[0]! : `audio/ep/${sha(keys.join('|'))}.mp3`;
  return { objectKey, parts: keys, durationMs, chapters, briefKey };
}

/** 이어 붙인 파일이 없으면 만든다(세그먼트 MP3를 바이트 그대로 이어 붙임, 재인코딩 없음) */
async function ensureObject(ep: Episode): Promise<string> {
  const key = ep.objectKey!;
  if (ep.parts.length <= 1 || (await audioStore.exists(key))) return key;
  let build = episodeBuilds.get(key);
  if (!build) {
    build = (async () => {
      const files = await Promise.all(ep.parts.map((k) => audioStore.get(k)));
      if (files.some((f) => !f)) throw new Error('세그먼트 파일이 없어요');
      await audioStore.put(key, concatBytes(files as Uint8Array[]), 'audio/mpeg');
    })().finally(() => episodeBuilds.delete(key));
    episodeBuilds.set(key, build);
  }
  await build;
  return key;
}

const requester = (p: Profile): Requester => ({ userId: p.id });

/**
 * 오늘 에피소드. generate가 false면 이미 만든 음성만 본다(페이지를 열 때).
 * ids를 주면 그중 오늘 피드에 있는 소식만 ids 차례로 넣는다: 화면이 받아 둔 목록과 플레이어 목록·길이·차례가 어긋나지 않게(화면을 연 뒤 피드가 늘어도)
 */
export async function getEpisode(
  profile: Profile,
  date: string,
  persona: Persona,
  voice: Voice,
  { generate, ids = null }: { generate: boolean; ids?: number[] | null },
): Promise<Episode> {
  let items = await feedItems(profile, date);
  if (ids) {
    // 화면 차례(ids, '가장 많이 다룬 소식'이 맨 위인 feed.ts headlineFirst)대로 듣는다(2026-11-11: 피드 순번대로 두어 노선과 듣는 차례가 어긋났다).
    // 소식마다 음성은 따로라 차례만 바뀌면 새로 만들지 않고 이어 붙이기만 한다
    const order = new Map(ids.map((id, k) => [id, k] as const));
    items = items.filter((i) => order.has(i.clusterId)).sort((a, b) => order.get(a.clusterId)! - order.get(b.clusterId)!);
  }
  const engine = await ttsEngineFor(entitlements(profile).audio);
  // 소식이 있으면 맨 앞에 그 브리핑(소식들의 출근길·퇴근길)의 브리핑을 붙인다. 다 뺐으면(빈 목록) 브리핑도 없다
  const brief = items.length ? await briefingPart(profile, date, items[0]!.slot ?? 'am') : null;
  const parts = items.map(itemPart);
  return assemble(brief ? [brief, ...parts] : parts, persona, voice, engine, generate ? requester(profile) : null);
}

/** 음성 파일 주소(없는 소식은 만든 뒤). R2면 서명 URL */
export async function episodeFileUrl(ep: Episode): Promise<string | null> {
  if (!ep.objectKey) return null;
  return audioStore.url(await ensureObject(ep));
}

/**
 * 소식 하나짜리 에피소드. 목록 카드·상세의 "듣기"와 전체 듣기를 소식 하나씩 들을 때 쓴다.
 * BRIEFING_ID면 지금 브리핑(출근길·퇴근길)의 브리핑 하나짜리(인사이트가 없으면 null)
 */
export async function getItemEpisode(profile: Profile, clusterId: number, persona: Persona, voice: Voice, { generate }: { generate: boolean }): Promise<Episode | null> {
  const engine = await ttsEngineFor(entitlements(profile).audio);
  if (clusterId === BRIEFING_ID) {
    const { slot } = await todayFillStatus(profile);
    const brief = await briefingPart(profile, kstDate(), slot);
    return brief && assemble([brief], persona, voice, engine, generate ? requester(profile) : null);
  }
  const found = await findFeedItem(profile, clusterId);
  if (!found) return null;
  return assemble([itemPart(found.item)], persona, voice, engine, generate ? requester(profile) : null);
}

/**
 * 보관함 플레이리스트(Premium). 고른 소식을 고른 순서대로 이어 붙인다. 받은 피드에 없는 소식은 뺀다.
 * 순번은 플레이리스트 안의 순서(1부터)로 바꾼다(원래 순번은 그날 피드의 순번이라)
 */
export async function getPlaylistEpisode(
  profile: Profile,
  ids: number[],
  persona: Persona,
  voice: Voice,
  { generate }: { generate: boolean },
): Promise<{ items: FeedItem[]; episode: Episode }> {
  const engine = await ttsEngineFor(entitlements(profile).audio);
  const items = (await playlistItems(profile, ids)).map((item, i) => ({ ...item, rank: i + 1 }));
  return { items, episode: await assemble(items.map(itemPart), persona, voice, engine, generate ? requester(profile) : null) };
}
