"use client";

import { kstDate } from "@maengo/core/kst";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { answerContextAction } from "@/app/(app)/context-actions";
import { IconClose } from "@/components/icons";
import { useCallName } from "@/components/providers/ProfileProvider";
import { Spinner } from "@/components/ui/Spinner";
import { SKIP, type PickedQuestion } from "@/lib/context";

// 내 맞춤 정보 질문(2026-11-11 사용자: 대놓고 묻지 말고 기사를 보다 다른 화면으로 넘어갈 때, 기사를 볼 때처럼 귀찮지 않을 만큼만).
// - 기사 아래(끝까지 읽은 자리)에 작은 줄 하나(ContextAskInline). 보이면 오늘은 그걸로 끝
// - 끝까지 안 보고 다른 화면으로 넘어가면 그 화면 아래쪽에 작은 알림으로 한 번(ContextToastHost, 10초 뒤 저절로 닫힌다)
// 하루에 한 번만(이 기기, localStorage). ✕는 '나중에'(7일 동안 다시 묻지 않는다). '해요'면 국내·미국처럼 이어 묻는 질문을 같은 자리에서 바로

const SHOWN_KEY = "maengo_ctx_ask_shown";

function shownToday(): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === kstDate();
  } catch {
    return false;
  }
}
function markShown() {
  try {
    localStorage.setItem(SHOWN_KEY, kstDate());
  } catch {}
}

// 기사에서 못 보고 넘어간 질문(다음 화면 알림으로)
type Leaving = { q: PickedQuestion; day: string } | null;
let leaving: Leaving = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const noSubscribe = () => () => {};
function setLeaving(v: Leaving) {
  leaving = v;
  listeners.forEach((l) => l());
}

/** 질문 한 줄(묻는 말 + 고르기 + ✕). 답하면 이어 묻는 질문으로 바뀌고, 없으면 onDone */
function QuestionRow({ q: first, day, onDone, tone }: { q: PickedQuestion; day: string; onDone: () => void; tone: "inline" | "toast" }) {
  const [q, setQ] = useState(first);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const answer = (value: string) =>
    start(async () => {
      setPicked(value);
      const res = await answerContextAction(q.key, value, day).catch(() => ({ ok: false, next: null }));
      setPicked(null);
      if (res.ok && res.next) setQ(res.next);
      else onDone();
    });
  const chip = tone === "toast" ? "bg-white/12 text-white" : "bg-snow text-ink";
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.02em]">{q.ask}</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={q.ask}>
          {q.options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={busy}
              onClick={() => answer(o.value)}
              className={`flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold active:scale-95 motion-reduce:active:scale-100 ${picked === o.value ? "bg-mango text-[#1F2340]" : chip}`}
            >
              {busy && picked === o.value && <Spinner />}
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        aria-label="나중에"
        disabled={busy}
        onClick={() => answer(SKIP)}
        className={`-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full ${tone === "toast" ? "text-white/60" : "text-faint"}`}
      >
        <IconClose className="size-4" />
      </button>
    </div>
  );
}

/** 기사 아래 작은 질문 줄. 오늘 이미 물었으면 그리지 않는다. 안 보고 떠나면 다음 화면 알림으로 넘긴다 */
export function ContextAskInline({ question, day }: { question: PickedQuestion | null; day: string }) {
  const name = useCallName();
  // 보일지는 처음 그릴 때 한 번만 정한다(보이는 순간 '오늘 물었음'으로 남겨도 스스로 사라지지 않게)
  const decided = useRef<boolean | null>(null);
  const can = useSyncExternalStore(
    noSubscribe,
    () => (decided.current ??= !!question && !shownToday()),
    () => false,
  );
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const answered = useRef(false);

  // 화면에 보이면 오늘은 이걸로 끝(다음 화면 알림은 안 띄운다)
  useEffect(() => {
    if (!can || !ref.current) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        seen.current = true;
        markShown();
        io.disconnect();
      }
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [can]);

  // 끝까지 안 보고 떠나면 다음 화면에서 한 번 묻는다
  useEffect(() => {
    if (!can || !question) return;
    return () => {
      if (!seen.current && !answered.current && !shownToday()) {
        markShown();
        setLeaving({ q: question, day });
      }
    };
  }, [can, question, day]);

  if (!can || !question || done) return null;
  return (
    <div ref={ref} className="mt-8 rounded-2xl border border-line px-4 pb-3 pt-3.5">
      <p className="mb-1.5 text-[12px] font-semibold text-sub">이 소식, {name ? `${name}님께 ` : ""}더 맞춰 드릴게요</p>
      <QuestionRow
        q={question}
        day={day}
        tone="inline"
        onDone={() => {
          answered.current = true;
          setDone(true);
        }}
      />
    </div>
  );
}

/** 기사에서 못 보고 넘어간 질문을 다음 화면 아래쪽에 한 번. 10초 동안 손대지 않으면 저절로 닫힌다((app) 레이아웃) */
export function ContextToastHost() {
  const pending = useSyncExternalStore(subscribe, () => leaving, () => null);
  const pathname = usePathname();
  const name = useCallName();
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!pending || touched) return;
    const t = window.setTimeout(() => setLeaving(null), 10_000);
    return () => window.clearTimeout(t);
  }, [pending, touched]);

  // 기사 화면에서는 띄우지 않는다(기사 아래 줄이 그 몫이다)
  if (!pending || pathname.startsWith("/article")) return null;
  return (
    <div
      role="dialog"
      aria-label="맞춤 정보 질문"
      onPointerDown={() => setTouched(true)}
      className="rise fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[420px] rounded-[20px] bg-[#1F2340] px-4 pb-3 pt-3 text-white shadow-[0_12px_32px_rgb(31_35_64/0.3)] lg:bottom-28"
    >
      <p className="mb-1.5 text-[12px] font-semibold text-mango">방금 본 {pending.q.about}, {name ? `${name}님께` : "더"} 맞춰 드릴게요</p>
      <QuestionRow key={pending.q.key} q={pending.q} day={pending.day} tone="toast" onDone={() => setLeaving(null)} />
    </div>
  );
}
