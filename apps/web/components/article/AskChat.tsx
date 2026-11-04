"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { IconMic } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { useProfile } from "@/components/providers/ProfileProvider";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";
import { ASK_CHIPS, ASK_DAILY, ASK_TEXT_MAX, parseAskFrames, plainAnswer, type AskTurn } from "@/lib/ask";
import { withBase } from "@/lib/base-path";
import { startVoice, voiceKind } from "@/lib/native/voice";
import type { FeedItem } from "@/lib/types";

// 맹고 AI 대화(2026-11-03). 글 화면 오른쪽 아래 맹고 AI 버튼(AskDock.tsx)이 웹은 창, 앱은 시트로 연다.
// 무엇이든 묻는다. 읽고 있는 소식은 서버가 맥락으로 붙인다(lib/server/ask.ts). 하루 횟수가 있다.
// 대화는 이 탭에서만 기억한다(sessionStorage, 창을 닫거나 옆 글로 넘겼다 돌아와도 남게). 서버는 저장하지 않는다.
// 이어서 물을 때 앞선 대화를 같이 보낸다(최근 6줄, 서버도 자른다).
// 답은 서버가 SSE로 조각조각 보내고(2026-11-04), 받는 대로 말풍선에 써 나간다. 다 받은 답만 대화에 남긴다.
// 처음엔 그 소식에 맞춘 추천 질문 3개를 보인다(서버가 소식마다 한 번 만들어 둔다, lib/server/ask-suggest.ts).
// 마이크로 말하면 알아들은 글이 입력칸에 채워지고, 보내기는 사람이 누른다(잘못 알아들은 걸 고칠 수 있게, lib/native/voice.ts).

type Message = AskTurn & { id: number };
type Problem = "daily_limit" | "failed" | "mic_denied" | "mic_failed";

const noSubscribe = () => () => {};

/** 이 탭에서 받아 둔 추천 질문(창을 다시 열 때 또 묻지 않게) */
const suggested = new Map<number, string[]>();

// 글마다 대화(JSON 글). 메모리가 먼저고, sessionStorage는 새로 불러왔을 때를 위해 같이 쓴다(막힌 브라우저는 메모리에만)
const memory = new Map<number, string>();
const listeners = new Set<() => void>();
const storageKey = (clusterId: number) => `maengo.ask.${clusterId}`;

function readRaw(clusterId: number): string {
  const hit = memory.get(clusterId);
  if (hit !== undefined) return hit;
  try {
    return sessionStorage.getItem(storageKey(clusterId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): Message[] {
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list as Message[]) : [];
  } catch {
    return [];
  }
}

function write(clusterId: number, messages: Message[]) {
  const raw = JSON.stringify(messages.slice(-20));
  memory.set(clusterId, raw);
  try {
    sessionStorage.setItem(storageKey(clusterId), raw);
  } catch {
    // 사생활 보호 모드 등은 메모리에만
  }
  listeners.forEach((l) => l());
}

/** /api/ask의 SSE를 읽어 답 전체(평문 정리 전)를 돌려준다. 받는 동안 지금까지의 글을 onText로 넘긴다 */
async function readAnswer(res: Response, onText: (raw: string) => void): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("failed");
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, rest } = parseAskFrames(buffer + decoder.decode(value, { stream: true }));
    buffer = rest;
    for (const e of events) {
      if (e.event === "delta") {
        raw += e.text;
        onText(raw);
      } else if (e.event === "done") return raw;
      else throw new Error(e.error);
    }
  }
  // 끝 표시 없이 끊겼다
  throw new Error("failed");
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * window: 웹의 떠 있는 창. 창 높이를 나눠 쓰고 대화만 스크롤한다.
 * sheet: 앱의 아래 시트. 시트는 내용만큼 올라오고(최대 85%), 대화가 길면 대화만 스크롤한다(시트 끌기는 막는다)
 */
export function AskChat({ item, variant }: { item: Pick<FeedItem, "clusterId" | "category">; variant: "window" | "sheet" }) {
  const profile = useProfile();
  const id = item.clusterId;
  // 서버에서는 빈 대화로 그리고, 붙은 뒤 이 탭에 남은 대화를 읽는다
  const raw = useSyncExternalStore(subscribe, () => readRaw(id), () => "[]");
  const messages = useMemo(() => parse(raw), [raw]);
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState(false);
  /** 지금 받고 있는 답(평문 정리 전). 받기 전엔 빈 글 */
  const [streaming, setStreaming] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** 열 때는 바로, 이번에 물은 뒤로는 부드럽게 맨 아래로 */
  const smooth = useRef(false);
  /** 맨 아래를 따라갈지. 답이 써지는 동안 위로 올려 읽고 있으면 끌어내리지 않는다(다시 맨 아래로 오면 따라간다) */
  const stick = useRef(true);
  const lastTop = useRef(0);
  // 음성 입력: 이 기기에서 쓸 수 있을 때만 마이크 버튼을 둔다
  const voice = useSyncExternalStore(noSubscribe, voiceKind, () => null);
  const [listening, setListening] = useState(false);
  const stopVoice = useRef<(() => void) | null>(null);
  const [chips, setChips] = useState<string[] | null>(() => suggested.get(id) ?? null);

  // 추천 질문: 대화가 비어 있을 때만 받는다. 못 받으면 늘 쓰는 질문
  const empty = messages.length === 0 && !waiting;
  useEffect(() => {
    if (!empty || chips) return;
    let live = true;
    fetch(withBase(`/api/ask/suggest?clusterId=${id}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { questions?: unknown } | null) => {
        const list = Array.isArray(data?.questions) && data.questions.every((q) => typeof q === "string") ? (data.questions as string[]) : ASK_CHIPS;
        suggested.set(id, list);
        if (live) setChips(list);
      })
      .catch(() => {
        if (live) setChips(ASK_CHIPS);
      });
    return () => {
      live = false;
    };
  }, [empty, chips, id]);

  // 글이 바뀌면(적기·음성) 입력칸 높이를 맞춘다(최대 120px)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  // 창·시트를 닫으면 듣기도 멈춘다
  useEffect(() => () => stopVoice.current?.(), []);

  async function toggleVoice() {
    if (!voice) return;
    if (listening) {
      stopVoice.current?.();
      return;
    }
    setProblem(null);
    setListening(true);
    track("ask", { category: item.category, action: "voice" });
    // 이미 적어 둔 글 뒤에 이어 붙인다
    const before = text.trim() ? `${text.trim()} ` : "";
    stopVoice.current = await startVoice(voice, {
      onText: (heard) => setText(`${before}${heard}`.slice(0, ASK_TEXT_MAX)),
      onEnd: () => {
        stopVoice.current = null;
        setListening(false);
      },
      onError: (e) => setProblem(e === "denied" ? "mic_denied" : "mic_failed"),
    });
  }

  useEffect(() => {
    const el = listRef.current;
    if (!el || !stick.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 답이 써지는 동안은 글이 늘 때마다 바로 붙는다(부드럽게 하면 따라가다 밀린다)
    el.scrollTo({ top: el.scrollHeight, behavior: smooth.current && !reduce && !streaming ? "smooth" : "auto" });
  }, [messages.length, waiting, streaming]);

  // 데스크톱은 열자마자 적을 수 있게. 휴대폰은 자판이 화면을 가리지 않게 누를 때까지 둔다
  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) inputRef.current?.focus();
  }, []);

  const push = (m: Omit<Message, "id">) => {
    const list = parse(readRaw(id));
    write(id, [...list, { ...m, id: list.reduce((n, x) => Math.max(n, x.id), 0) + 1 }]);
  };

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || waiting) return;
    stopVoice.current?.();
    setProblem(null);
    setWaiting(true);
    smooth.current = true;
    stick.current = true;
    const history: AskTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    push({ role: "user", text: question });
    setText("");
    // 휴대폰은 자판을 내려 답이 보이게
    if (!window.matchMedia("(hover: hover)").matches) inputRef.current?.blur();
    try {
      const res = await fetch(withBase("/api/ask"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clusterId: id, question, history }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      const answer = plainAnswer(await readAnswer(res, setStreaming));
      if (!answer) throw new Error("failed");
      // 받던 말풍선이 대화의 답으로 한 번에 바뀌게(둘이 잠깐 겹쳐 보이지 않게)
      flushSync(() => {
        push({ role: "model", text: answer });
        setStreaming("");
        setWaiting(false);
      });
      track("ask", { category: item.category, action: "answered" });
    } catch (e) {
      // 답을 못 받은 질문은 지우고 입력칸에 돌려놓는다
      write(id, parse(readRaw(id)).slice(0, -1));
      setText(question);
      const limit = (e as Error).message === "daily_limit";
      setProblem(limit ? "daily_limit" : "failed");
      track("ask", { category: item.category, action: limit ? "limit" : "error" });
    } finally {
      setStreaming("");
      setWaiting(false);
    }
  }

  const sheet = variant === "sheet";

  return (
    <div className={`flex flex-col ${sheet ? "" : "min-h-0 flex-1"}`}>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop < lastTop.current - 2) stick.current = false;
          else if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) stick.current = true;
          lastTop.current = el.scrollTop;
        }}
        data-no-sheet-drag={sheet || undefined}
        className={`overflow-y-auto overscroll-contain ${sheet ? "max-h-[calc(85dvh-190px)]" : "min-h-0 flex-1 px-4 py-4"}`}
      >
        {empty ? (
          <div className="flex flex-wrap gap-2" aria-busy={!chips}>
            {chips
              ? chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => ask(c)}
                    className="min-h-11 rounded-full border-2 border-line bg-paper px-4 text-left text-[14px] font-bold hover:border-mango hover:bg-mango-tint"
                  >
                    {c}
                  </button>
                ))
              : // 추천 질문을 받는 동안 같은 자리에 빈 칸(받으면 그대로 바뀌어 자리가 덜 흔들린다)
                [128, 152, 112].map((w) => <span key={w} aria-hidden="true" className="h-11 rounded-full bg-snow motion-safe:animate-pulse" style={{ width: w }} />)}
          </div>
        ) : (
          <ol aria-live="polite" className="flex flex-col gap-3">
            {messages.map((m) =>
              m.role === "user" ? (
                <li key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-mango-tint px-4 py-2.5 text-[15px] font-semibold leading-relaxed">
                    {m.text}
                  </p>
                </li>
              ) : (
                <li key={m.id} className="flex items-start gap-2">
                  <Mascot className="size-9 shrink-0" />
                  <p className="min-w-0 max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border-2 border-line bg-paper px-4 py-2.5 text-[15px] font-medium leading-[1.7]">
                    {m.text}
                  </p>
                </li>
              ),
            )}
            {waiting && (
              <li className="flex items-start gap-2">
                <Mascot className="size-9 shrink-0" />
                {streaming ? (
                  <>
                    {/* 써지는 동안은 읽어 주지 않고, 다 받으면 대화에 들어간 답을 한 번 읽는다 */}
                    <span role="status" className="sr-only">
                      답을 쓰는 중
                    </span>
                    <p
                      aria-hidden="true"
                      className="min-w-0 max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border-2 border-line bg-paper px-4 py-2.5 text-[15px] font-medium leading-[1.7]"
                    >
                      {plainAnswer(streaming)}
                    </p>
                  </>
                ) : (
                  <span role="status" aria-label="답을 쓰는 중" className="flex gap-1 rounded-2xl rounded-tl-md border-2 border-line bg-paper px-4 py-4">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-1.5 rounded-full bg-faint motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                )}
              </li>
            )}
          </ol>
        )}
      </div>

      <div className={sheet ? "pt-3" : "border-t-2 border-line p-3"}>
        {problem && (
          <p role="alert" className="mb-2 text-[14px] font-bold text-cherry">
            {problem === "failed" ? (
              "답하지 못했어요. 잠시 뒤 다시 물어봐 주세요."
            ) : problem === "mic_denied" ? (
              "마이크를 쓸 수 있게 허용해 주세요."
            ) : problem === "mic_failed" ? (
              "말을 알아듣지 못했어요. 다시 말해 주세요."
            ) : profile.plan === "free" ? (
              <>
                오늘은 다 물어봤어요.{" "}
                <Link href="/premium" className="text-sky-dark underline underline-offset-2">
                  Premium은 하루 {ASK_DAILY.plus}번
                </Link>
              </>
            ) : (
              "오늘은 다 물어봤어요. 내일 다시 물어봐 주세요."
            )}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="ask-text" className="sr-only">
            맹고 AI에게 물어볼 말
          </label>
          <textarea
            id="ask-text"
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={ASK_TEXT_MAX}
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // 데스크톱: 엔터로 보내고 Shift+엔터로 줄바꿈. 한글 조합 중 엔터는 보내지 않는다
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
                e.preventDefault();
                void ask(text);
              }
            }}
            placeholder={listening ? "듣고 있어요" : "궁금한 걸 물어보세요"}
            className="tile max-h-[120px] min-h-12 flex-1 resize-none px-4 py-3 text-[16px] font-semibold leading-snug placeholder:text-faint"
          />
          {voice && (
            <button
              type="button"
              onClick={() => void toggleVoice()}
              disabled={waiting}
              aria-pressed={listening}
              aria-label={listening ? "말하기 멈추기" : "말로 물어보기"}
              className={`tile flex size-12 shrink-0 items-center justify-center ${listening ? "border-cherry text-cherry" : "text-sub hover:bg-snow"}`}
            >
              <IconMic className={`size-6 ${listening ? "motion-safe:animate-pulse" : ""}`} />
            </button>
          )}
          <button type="submit" disabled={waiting || !text.trim()} aria-label={waiting ? "답을 기다리는 중" : undefined} className="btn min-h-12 shrink-0 px-5 text-[15px]">
            {waiting ? <Spinner /> : "보내기"}
          </button>
        </form>
      </div>
    </div>
  );
}
