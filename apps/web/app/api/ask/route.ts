import { NextResponse, type NextRequest } from "next/server";
import { askFrame } from "@/lib/ask";
import { parseHistory, startAsk, type AskError } from "@/lib/server/ask";
import { currentProfile } from "@/lib/server/session";

// 글 화면의 맹고 AI(components/article/AskChat.tsx). POST { clusterId, question, history } (lib/server/ask.ts)
// 물을 수 없으면 JSON {error}와 상태 코드. 되면 SSE로 답 조각을 흘려 보낸다: delta {text} … → done 또는 error(lib/ask.ts askFrame)
export const maxDuration = 30;

const STATUS: Record<AskError, number> = { empty: 400, too_long: 400, not_found: 404, daily_limit: 429, busy: 503 };

export async function POST(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const clusterId = Number(body?.clusterId);
  if (!Number.isInteger(clusterId) || typeof body?.question !== "string") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const res = await startAsk(profile, clusterId, body.question, parseHistory(body.history));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: STATUS[res.error] });

  const answer = res.stream;
  // 화면이 떠나면(연결 끊김) Gemini 호출도 끊는다
  const abort = new AbortController();
  const encoder = new TextEncoder();
  async function* frames() {
    try {
      for await (const text of answer(abort.signal)) yield askFrame({ event: "delta", text });
      yield askFrame({ event: "done" });
    } catch {
      if (!abort.signal.aborted) yield askFrame({ event: "error", error: "busy" });
    }
  }
  const it = frames();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await it.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      abort.abort();
      await it.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      // 중간에서 모아 보내거나 압축하느라 늦추지 않게
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
