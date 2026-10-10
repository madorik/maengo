import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { templateScript } from '@maengo/core/ai';
import { GeminiQuotaError } from '@maengo/core/gemini';
import { estimateTimeline, layoutChapters, PERSONAS, voiceKey } from '@maengo/core/audio';
import type { Chapter, Persona, ScriptLine, Voice } from '@maengo/core/types';
import type { FeedItem } from '../types';
import { tts, ttsModel } from './ai';
import { TtsQuotaError } from './google-tts';
import { audioStore } from './audio-store';
import { db, must } from './db';
import { feedItems, findFeedItem } from './feed';
import { concatBytes, encodeMp3, mp3DurationMs } from './mp3';
import { blockTts, recordUse, TtsBusyError, ttsBlockedUntil } from './limits';
import type { Profile } from './profile';

// 듣기(PLAN.md 8장). 음성은 사용자가 재생을 누를 때만 만든다. 페이지를 열 때는 이미 만든 음성이 있는지만 본다.
// 세그먼트 = 소식 하나 × 말투 × 목소리. 대본 내용 해시로 키를 만들어 같은 대본이면 누가 듣든 다시 만들지 않는다.
// 파일은 MP3로 R2(audio/seg/<key>.mp3)에, 줄별 시각은 audio_segments에 둔다.
// 오늘 전체 듣기는 세그먼트 MP3를 이어 붙인 파일(audio/ep/<hash>.mp3)을 처음 열 때 만든다.

interface SegmentLine {
  who?: string;
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
}

/** 대본·TTS 입력 형식을 바꾸면 올린다(예전 음성을 다시 쓰지 않게). 2: 말투 지시문을 빼고 대본만 읽게 함(2026-10-10) */
const SCRIPT_VERSION = 2;
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

function scriptOf(item: FeedItem, persona: Persona): ScriptLine[] {
  return templateScript({ model: '', persona, topicName: item.topicName, title: item.title, short: item.short, body: item.body, why: item.why });
}

function segmentKey(lines: ScriptLine[], persona: Persona, voice: Voice): string {
  const vk = voiceKey(persona, voice);
  return `${persona}-${vk}-${sha(JSON.stringify({ v: SCRIPT_VERSION, model: ttsModel(), persona, vk, lines }))}`;
}

async function findSegments(keys: string[]): Promise<Map<string, SegmentRow>> {
  if (!keys.length) return new Map();
  const rows = must(await db.from('audio_segments').select('key,r2_key,duration_ms,lines').in('key', keys), 'audio_segments') as SegmentRow[];
  return new Map(rows.map((r) => [r.key, r]));
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
  userId: string;
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
async function waitForSegment(key: string): Promise<SegmentRow | null> {
  for (let waited = 0; waited < LOCK_STALE_MS; waited += 2000) {
    await sleep(2000);
    const row = (await findSegments([key])).get(key);
    if (row) return row;
    const { data } = await db.from('audio_jobs').select('key').eq('key', key).maybeSingle();
    if (!data) return null;
  }
  return null;
}

function generateSegment(item: FeedItem, persona: Persona, voice: Voice, key: string, lines: ScriptLine[], who: Requester): Promise<SegmentRow> {
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    const t0 = Date.now();
    const vk = voiceKey(persona, voice);
    let pcm: Uint8Array;
    let sampleRate: number;
    let timed: SegmentLine[];
    let source: string;
    const legacy = await legacyPcm(key);
    if (legacy) {
      ({ pcm, sampleRate } = legacy);
      timed = legacy.lines;
      source = '예전 캐시에서 옮김';
    } else {
      // 서비스 한도(Gemini 무료 등급 하루 요청 수)가 찼으면 부르지 않는다
      const busy = await ttsBlockedUntil();
      if (busy) throw new TtsBusyError(busy);
      // 다른 서버가 같은 음성을 만들고 있으면 기다렸다가 그것을 쓴다(같은 음성을 두 번 만들지 않게)
      if (!(await acquireLock(key))) {
        const done = await waitForSegment(key);
        if (done) return done;
        throw new Error('다른 요청이 이 음성을 만들다 실패했어요');
      }
      try {
        // 잠금을 얻기 직전에 다른 서버가 다 만들었을 수 있다
        const again = (await findSegments([key])).get(key);
        if (again) {
          await releaseLock(key);
          return again;
        }
        let speech;
        try {
          speech = await withTtsSlot(() => tts.speak({ model: ttsModel(), persona, voice: vk, lines }));
        } catch (e) {
          if (e instanceof GeminiQuotaError || e instanceof TtsQuotaError) {
            // 알려 준 시각까지 TTS를 부르지 않는다. 모르면 Gemini(하루 한도)는 한 시간, Google(분당 한도)은 5분
            const minutes = e.retryMs ? Math.min(24 * 60, Math.ceil(e.retryMs / 60_000)) : e instanceof TtsQuotaError ? 5 : 60;
            await blockTts(minutes);
            throw new TtsBusyError(new Date(Date.now() + minutes * 60_000));
          }
          throw e;
        }
        if (speech.bitsPerSample !== 16) throw new Error('16비트 PCM만 MP3로 바꿀 수 있어요');
        pcm = speech.pcm;
        sampleRate = speech.sampleRate;
        timed = lines.map((l, i) => ({ ...l, ...speech.lineTimesMs[i]! }));
        source = 'TTS';
        await recordUse(who.userId, 'voice');
      } catch (e) {
        await releaseLock(key);
        throw e;
      }
    }
    const mp3 = encodeMp3(pcm, sampleRate);
    const r2Key = `audio/seg/${key}.mp3`;
    await audioStore.put(r2Key, mp3, 'audio/mpeg');
    const row: SegmentRow = { key, r2_key: r2Key, duration_ms: mp3DurationMs(mp3.length), lines: timed };
    must(
      await db.from('audio_segments').upsert(
        { ...row, cluster_id: item.clusterId, persona, voice: vk, model: ttsModel(), bytes: mp3.length },
        { onConflict: 'key' },
      ),
      'audio_segments upsert',
    );
    await releaseLock(key);
    console.log(`[tts] #${item.clusterId} ${persona}/${vk} ${(row.duration_ms / 1000).toFixed(1)}초 · ${Math.round(mp3.length / 1024)}KB · ${source} · ${((Date.now() - t0) / 1000).toFixed(1)}초 걸림`);
    return row;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function assemble(items: FeedItem[], persona: Persona, voice: Voice, generate: Requester | null): Promise<Episode> {
  const scripts = items.map((item) => {
    const lines = scriptOf(item, persona);
    return { item, lines, key: segmentKey(lines, persona, voice) };
  });
  const found = await findSegments(scripts.map((s) => s.key));
  const segs = await Promise.all(
    scripts.map(async (s) => found.get(s.key) ?? (generate ? generateSegment(s.item, persona, voice, s.key, s.lines, generate) : null)),
  );
  const parts = scripts.map((s, i) => {
    const seg = segs[i];
    if (seg) return { durationMs: seg.duration_ms, lines: seg.lines };
    const { lineTimesMs, durationMs } = estimateTimeline(s.lines, persona);
    return { durationMs, lines: s.lines.map((l, j) => ({ ...l, ...lineTimesMs[j]! })) };
  });
  const chapters = layoutChapters(
    items.map((item, i) => ({ rank: item.rank, clusterId: item.clusterId, title: item.title, durationMs: parts[i]!.durationMs, lines: parts[i]!.lines })),
  );
  const durationMs = chapters.at(-1)?.endMs ?? 0;
  const ready = segs.length > 0 && segs.every((s) => s !== null);
  if (!ready) return { objectKey: null, parts: [], durationMs, chapters };
  const keys = (segs as SegmentRow[]).map((s) => s.r2_key);
  const objectKey = keys.length === 1 ? keys[0]! : `audio/ep/${sha(keys.join('|'))}.mp3`;
  return { objectKey, parts: keys, durationMs, chapters };
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

/** 오늘 에피소드. generate가 false면 이미 만든 음성만 본다(페이지를 열 때) */
export async function getEpisode(profile: Profile, date: string, persona: Persona, voice: Voice, { generate }: { generate: boolean }): Promise<Episode> {
  return assemble(await feedItems(profile, date), persona, voice, generate ? requester(profile) : null);
}

/** 음성 파일 주소(없는 소식은 만든 뒤). R2면 서명 URL */
export async function episodeFileUrl(ep: Episode): Promise<string | null> {
  if (!ep.objectKey) return null;
  return audioStore.url(await ensureObject(ep));
}

/** 아직 만들지 않은 말투의 길이 어림값. 대본 글자 수로 계산한다. */
export async function estimateDurations(profile: Profile, date: string): Promise<Record<Persona, number[]>> {
  const items = await feedItems(profile, date);
  const out = {} as Record<Persona, number[]>;
  for (const p of PERSONAS) out[p.id] = items.map((item) => estimateTimeline(scriptOf(item, p.id), p.id).durationMs);
  return out;
}

/** 소식 하나짜리 에피소드. 목록 카드·상세의 "듣기"가 쓴다 */
export async function getItemEpisode(profile: Profile, clusterId: number, persona: Persona, voice: Voice, { generate }: { generate: boolean }): Promise<Episode | null> {
  const found = await findFeedItem(profile, clusterId);
  if (!found) return null;
  return assemble([found.item], persona, voice, generate ? requester(profile) : null);
}
