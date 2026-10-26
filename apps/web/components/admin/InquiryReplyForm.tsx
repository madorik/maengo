"use client";

import { useActionState, useState } from "react";
import { redraftInquiryAction, replyInquiryAction } from "@/app/admin/inquiry-actions";
import { IconSparkles } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { framedReply, INQUIRY_REPLY_MAX, stripReplyFrame } from "@/lib/inquiry";

/**
 * 관리자 문의 답장 칸. AI 초안(가운데 본문)에 정해진 첫 인사·맺음말을 붙여 미리 채운다(초안이 없으면 틀만) — 읽고 보내기만 누르면 된다.
 * 'AI로 다시 쓰기'를 누르면 새 초안으로 바뀐다. 실패하면 적은 내용을 그대로 두고 이유를 보여 준다.
 * 부르는 쪽이 보낸 답장 수·초안 시각을 key로 줘서, 보내거나 다시 쓰면 칸이 새로 채워진다
 */
export function InquiryReplyForm({ id, to, draft, check }: { id: number; to: string; draft: string | null; check: string | null }) {
  const [state, action, pending] = useActionState(replyInquiryAction, null);
  const [redraft, redraftAction, redrafting] = useActionState(redraftInquiryAction, null);
  const [body, setBody] = useState(() => framedReply(draft ?? ""));
  const error = (state && !state.ok && state.error) || (redraft && !redraft.ok && redraft.error) || null;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`reply-${id}`} className="text-[12px] font-extrabold text-sub">
          {to}에게 답장{draft ? " · AI 초안" : ""}
        </label>
        <form action={redraftAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={redrafting || pending} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-extrabold text-sky-dark hover:bg-sky-tint disabled:opacity-60">
            {redrafting ? <Spinner className="size-3.5" /> : <IconSparkles className="size-4" />}
            {draft ? "AI로 다시 쓰기" : "AI로 쓰기"}
          </button>
        </form>
      </div>
      {check && (
        <p className="mt-1.5 rounded-lg bg-[#FFF1E6] px-3 py-2 text-[12px] font-bold leading-relaxed text-orange dark:bg-[#3A2414]">
          보내기 전에 확인: {check}
        </p>
      )}
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <textarea
          id={`reply-${id}`}
          name="body"
          rows={9}
          maxLength={INQUIRY_REPLY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="tile resize-y px-3 py-2 text-[14px] font-semibold leading-relaxed"
        />
        {error && (
          <p role="alert" className="text-[13px] font-bold text-cherry">
            {error}
          </p>
        )}
        <div>
          <button type="submit" disabled={pending || redrafting || !stripReplyFrame(body)} className="btn min-h-11 px-6 text-[14px]">
            {pending ? <Spinner /> : "보내기"}
          </button>
        </div>
      </form>
    </div>
  );
}
