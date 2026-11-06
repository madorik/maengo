"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { useCreep, useTick } from "./making";

// 오늘 소식 카드에서 듣기를 눌렀는데 음성을 새로 만들어야 할 때 그 카드 안에 보여 주는 진행 카드(2026-11-06 사용자 요청:
// 카드 머리의 작은 '음성 만드는 중'은 잘 안 보였다). 서버가 진행을 알려 주지 않아서 기다린 시간으로 말을 바꾸고 막대를 채운다.
// 문단별 동시 합성 뒤 소식 하나에 보통 5~10초(Premium Gemini 5초대, Free Chirp 9초대), 몰리면 TTS를 차례로 기다려 길어진다

/** 이만큼 넘게 기다릴 때만 보여 준다. 이미 만든 음성은 파일만 받으면 바로 나와서 잠깐 번쩍이지 않게 */
const SHOW_AFTER_MS = 700;

/** 기다린 시간(초)에 따라 바뀌는 말 */
function lineAt(sec: number): string {
  if (sec < 4) return "맹고가 음성을 만들고 있어요!";
  if (sec < 8) return "열심히 만들고 있어요!";
  if (sec < 20) return "거의 다 만들었어요!";
  return "조금만 더 기다려 주세요!";
}

/** 음성을 기다리는 동안만 그린다(기다림이 끝나면 부른 쪽이 뺀다). 다시 그리면 처음 말부터 */
export function VoiceMaking() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);
  return shown ? <Making /> : null;
}

function Making() {
  const sec = useTick(1000);
  // 8초쯤 80%, 20초쯤 90%를 넘고 그 뒤로는 거의 멈춘다(끝을 모르므로 100%는 채우지 않는다)
  const fill = useCreep(0.06, 0.94, 0.03);
  const line = lineAt(sec);
  return (
    <div className="mt-3 rounded-xl bg-sky-tint px-3 py-3">
      <p role="status" className="sr-only">
        음성을 만들고 있어요. 보통 5~10초 걸려요
      </p>
      <div className="flex items-center gap-3" aria-hidden>
        <Mascot mood="listen" className="bob size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p key={line} className="swap text-[16px] font-black leading-snug text-sky-dark">
            {line}
          </p>
          {/* 두 문장을 줄로 나눈다(한 줄로 두면 좁은 폰에서 '있어요'만 넘어간다) */}
          <p className="mt-0.5 text-[13px] font-semibold leading-snug text-ink/70">
            보통 5~10초 걸려요
            <br />
            사람이 몰리면 1분쯤 걸릴 수 있어요
          </p>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80" aria-hidden>
        <div className="stripes h-full rounded-full bg-sky transition-[width] duration-300 ease-out" style={{ width: `${Math.round(fill * 100)}%` }} />
      </div>
    </div>
  );
}
