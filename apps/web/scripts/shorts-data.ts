// 쇼츠 재료(소식 1개): 이미 만든 듣기 음성(MP3)과 줄별 시각, 제목·분야·출처를 outDir에 내려받는다. TTS는 부르지 않는다.
// 실행(apps/web에서): node --conditions=react-server --env-file=.env.local --import tsx scripts/shorts-data.ts <clusterId> <outDir> [f|m]
// 만든 voice.mp3·data.json은 apps/mobile/scripts/shorts/render.mjs가 쓴다.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { audioStore } from "../lib/server/audio-store";
import { db, must } from "../lib/server/db";

const [clusterArg, outDir, voiceArg] = process.argv.slice(2);
const clusterId = Number(clusterArg);
if (!clusterId || !outDir) throw new Error("사용법: shorts-data.ts <clusterId> <outDir> [f|m]");
const voice = voiceArg === "m" ? "m" : "f";

type Line = { text: string; startMs: number; endMs: number };
const seg = must(
  await db
    .from("audio_segments")
    .select("r2_key,duration_ms,lines")
    .eq("cluster_id", clusterId)
    .eq("persona", "announcer")
    .eq("voice", voice)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle(),
  "audio_segments",
) as { r2_key: string; duration_ms: number; lines: Line[] } | null;
if (!seg) throw new Error(`#${clusterId} ${voice} 음성이 아직 없어요(쇼츠는 이미 만든 음성만 쓴다)`);

const cluster = must(
  await db
    .from("clusters")
    .select("first_seen_at,summaries(title,tier),rep:items!clusters_rep_item_id_fkey(published_at,sources(name)),cluster_topics(relevance,topics(name))")
    .eq("id", clusterId)
    .single(),
  "clusters",
) as unknown as {
  first_seen_at: string;
  summaries: { title: string; tier: string }[];
  rep: { published_at: string | null; sources: { name: string } | null } | null;
  cluster_topics: { relevance: number; topics: { name: string } | null }[];
};

// 음성 첫 줄이 제목이다. 같은 제목의 요약을 고르고, 없으면 첫 줄에서 마침표만 뗀다
const spoken = seg.lines[0]?.text.replace(/\.$/, "") ?? "";
const title = cluster.summaries.find((s) => s.title.trim() === spoken)?.title ?? spoken;
const topic = [...cluster.cluster_topics].sort((a, b) => b.relevance - a.relevance)[0]?.topics?.name ?? "";

const mp3 = await audioStore.get(seg.r2_key);
if (!mp3) throw new Error(`음성 파일이 저장소에 없어요: ${seg.r2_key}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "voice.mp3"), mp3);
const data = {
  clusterId,
  voice,
  title,
  topic,
  source: cluster.rep?.sources?.name ?? "",
  date: cluster.rep?.published_at ?? cluster.first_seen_at,
  durationMs: seg.duration_ms,
  lines: seg.lines.map(({ text, startMs, endMs }) => ({ text, startMs, endMs })),
};
writeFileSync(path.join(outDir, "data.json"), JSON.stringify(data, null, 2));
console.log(`#${clusterId} ${title} · ${topic} · ${data.source} · ${(seg.duration_ms / 1000).toFixed(1)}초 · 줄 ${seg.lines.length}개 → ${outDir}`);
