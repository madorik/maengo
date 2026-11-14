// 글 화면의 맹고 AI(2026-11-03). 화면(components/article/AskDock.tsx·AskChat.tsx)과 서버(lib/server/ask.ts)가 같이 쓰는 값.
// 정책은 맹고-문서/소식-물어보기.md

/** 질문 하나의 최대 글자 수 */
export const ASK_TEXT_MAX = 200;

/** 플랜별 하루(KST) 질문 수. 답을 받은 질문만 센다. 무엇이든 물을 수 있어서 이 횟수가 비용을 막는다 */
export const ASK_DAILY: Record<"free" | "plus", number> = { free: 3, plus: 20 };

/** 이어서 묻기 위해 서버에 다시 보내는 앞선 대화 수(질문·답 합쳐서) */
export const ASK_HISTORY_TURNS = 6;

/** 처음에 눌러 바로 물어보는 질문. 소식에 맞춘 추천 질문(lib/server/ask-suggest.ts)을 못 만들 때 쓴다 */
export const ASK_CHIPS = ["더 쉽게 설명해 줘", "왜 중요한 소식이야?", "어려운 용어 풀어 줘"];

export type AskTurn = { role: "user" | "model"; text: string };

/** 무엇을 보다가 묻는지: 글 화면의 소식, 또는 오늘 화면 오늘의 흐름 하나(그 브리핑의 몇 번째 흐름, 2026-11-14) */
export type AskRef = { clusterId: number } | { flow: { date: string; slot: "am" | "pm"; index: number } };

/** 화면이 보낸 대상을 믿을 수 있는 모양으로(아니면 null). 흐름이 있으면 흐름으로 본다 */
export function parseAskRef(body: unknown): AskRef | null {
  const b = body as { clusterId?: unknown; flow?: { date?: unknown; slot?: unknown; index?: unknown } } | null;
  if (b?.flow) {
    const { date, slot, index } = b.flow;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (slot !== "am" && slot !== "pm")) return null;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 9) return null;
    return { flow: { date, slot, index } };
  }
  const clusterId = Number(b?.clusterId);
  return b?.clusterId != null && Number.isInteger(clusterId) ? { clusterId } : null;
}

/** 답 하나의 최대 글자 수. 넘으면 서버가 그만 받는다 */
export const ASK_ANSWER_MAX = 2000;

/**
 * 시킨 대로 평문이 아니면 굵게·제목·코드 블록 표시를 걷어 내고 목록 기호는 가운뎃점으로.
 * 답은 조각으로 오므로 화면은 지금까지 받은 글 전체에 매번 다시 건다(표시가 조각 사이에 갈려도 다 오면 맞게 걷힌다)
 */
export const plainAnswer = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^```\w*\s*$/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    // 줄을 안 바꾸고 이어 쓴 번호 목록("…있어요. 1. …")은 번호 앞에서 줄을 바꾼다
    .replace(/([가-힣][.?!])[ \t]+(?=\d{1,2}\.\s)/g, "$1\n")
    .trim()
    .slice(0, ASK_ANSWER_MAX);

/**
 * /api/ask 응답(SSE). 시작 전 오류(횟수·빈 질문 등)는 JSON {error}와 상태 코드로, 시작한 뒤엔 이벤트로 온다:
 * delta {text}(답 조각) → done {} 또는 error {error}
 */
export type AskEvent = { event: "delta"; text: string } | { event: "done" } | { event: "error"; error: string };

export function askFrame(e: AskEvent): string {
  const { event, ...data } = e;
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** 받은 SSE를 이벤트로 나눈다. 끝이 덜 온 조각은 남겨서 다음에 이어 붙인다 */
export function parseAskFrames(buffer: string): { events: AskEvent[]; rest: string } {
  const events: AskEvent[] = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    if (!event || !data) continue;
    try {
      events.push({ event, ...JSON.parse(data) } as AskEvent);
    } catch {
      // 깨진 줄은 건너뛴다
    }
  }
  return { events, rest };
}
