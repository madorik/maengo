import 'server-only';
import { dummyScript, modelFor } from '@maengo/core/ai';
import { concatWav, estimateTimeline, layoutChapters, PERSONAS, voiceKey } from '@maengo/core/audio';
import type { Chapter, Persona, Voice } from '@maengo/core/types';
import type { FeedItem } from '../types';
import { ai, ttsModel } from './ai';
import { feedItems, findFeedItem } from './feed';
import type { Profile } from './store';

// 에피소드 = 오늘 소식들의 음성 세그먼트를 이어 붙인 파일 하나 + 챕터 표(PLAN.md 8.2).
// 지금은 더미 TTS가 만든 WAV를 메모리에 둔다. 실제로는 파이프라인이 MP3를 R2에 올린다.

interface Segment {
  pcm: Uint8Array;
  sampleRate: number;
  bitsPerSample: 8 | 16;
  durationMs: number;
  lines: { who?: string; text: string; startMs: number; endMs: number }[];
}

export interface Episode {
  wav: Uint8Array;
  durationMs: number;
  chapters: Chapter[];
}

const g = globalThis as typeof globalThis & {
  __maengoSegments?: Map<string, Segment>;
  __maengoEpisodes?: Map<string, Episode>;
};
const segments = (g.__maengoSegments ??= new Map());
const episodes = (g.__maengoEpisodes ??= new Map());
const MAX_EPISODES = 6;

async function segmentFor(item: FeedItem, persona: Persona, voice: Voice): Promise<Segment> {
  const vk = voiceKey(persona, voice);
  // 대본에 순서 문장("세 번째 소식")과 토픽별 why가 들어가므로 둘 다 키에 넣는다.
  const key = `${item.clusterId}|${persona}|${vk}|${item.rank}|${item.why}`;
  const hit = segments.get(key);
  if (hit) return hit;
  const lines = await ai.script({
    model: modelFor('pro'),
    persona,
    rank: item.rank,
    topicName: item.topicName,
    title: item.title,
    short: item.short,
    body: item.body,
    why: item.why,
  });
  const speech = await ai.speak({ model: ttsModel(), persona, voice: vk, lines });
  const seg: Segment = {
    pcm: speech.pcm,
    sampleRate: speech.sampleRate,
    bitsPerSample: speech.bitsPerSample,
    durationMs: speech.durationMs,
    lines: lines.map((l, i) => ({ ...l, ...speech.lineTimesMs[i]! })),
  };
  segments.set(key, seg);
  return seg;
}

export async function getEpisode(profile: Profile, date: string, persona: Persona, voice: Voice): Promise<Episode> {
  const items = await feedItems(profile, date);
  const key = `${profile.id}|${date}|${persona}|${voiceKey(persona, voice)}|${items.map((i) => `${i.clusterId}:${i.why}`).join(',')}`;
  const hit = episodes.get(key);
  if (hit) return hit;

  const segs = await Promise.all(items.map((item) => segmentFor(item, persona, voice)));
  const chapters = layoutChapters(
    items.map((item, i) => ({
      rank: item.rank,
      clusterId: item.clusterId,
      title: item.title,
      durationMs: segs[i]!.durationMs,
      lines: segs[i]!.lines,
    })),
  );
  const first = segs[0];
  const wav = concatWav(segs.map((s) => s.pcm), first?.sampleRate ?? 8000, first?.bitsPerSample ?? 8);
  const durationMs = chapters.at(-1)?.endMs ?? 0;
  const episode = { wav, durationMs, chapters };

  episodes.set(key, episode);
  while (episodes.size > MAX_EPISODES) episodes.delete(episodes.keys().next().value!);
  return episode;
}

/** 아직 만들지 않은 말투의 길이 어림값. 대본 글자 수로 계산한다. */
export async function estimateDurations(profile: Profile, date: string): Promise<Record<Persona, number[]>> {
  const items = await feedItems(profile, date);
  const out = {} as Record<Persona, number[]>;
  for (const p of PERSONAS) {
    out[p.id] = items.map((item) => estimateTimeline(dummyScript({ model: '', persona: p.id, ...item }), p.id).durationMs);
  }
  return out;
}

/** 소식 하나만 담은 에피소드. 보관함의 지난 글을 들을 때 쓴다 */
export async function getItemEpisode(profile: Profile, clusterId: number, persona: Persona, voice: Voice): Promise<Episode | null> {
  const found = await findFeedItem(profile, clusterId);
  if (!found) return null;
  const { item } = found;
  const key = `item|${profile.id}|${clusterId}|${persona}|${voiceKey(persona, voice)}|${item.why}`;
  const hit = episodes.get(key);
  if (hit) return hit;
  const seg = await segmentFor(item, persona, voice);
  const chapters = layoutChapters([{ rank: item.rank, clusterId, title: item.title, durationMs: seg.durationMs, lines: seg.lines }]);
  const episode = { wav: concatWav([seg.pcm], seg.sampleRate, seg.bitsPerSample), durationMs: seg.durationMs, chapters };
  episodes.set(key, episode);
  while (episodes.size > MAX_EPISODES) episodes.delete(episodes.keys().next().value!);
  return episode;
}
