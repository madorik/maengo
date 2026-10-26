"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sendInquiryAction } from "@/app/contact/actions";
import { Mascot } from "@/components/Mascot";
import { Spinner } from "@/components/ui/Spinner";
import { INQUIRY_BODY_MAX, INQUIRY_CATEGORIES, type InquiryCategory } from "@/lib/inquiry";

// 문의하기 양식(/contact). 칸은 상태로 들고 있어서 보내다 실패해도 적은 내용이 남는다(폼 액션은 끝나면 칸을 비운다).
// 보내면 양식 대신 어디로 답을 주는지만 보여 준다.

export function ContactForm({ defaultEmail, home, category, preset }: { defaultEmail: string; home: string; category: InquiryCategory | null; preset: string }) {
  const [state, formAction, pending] = useActionState(sendInquiryAction, null);
  const [kind, setKind] = useState<InquiryCategory | null>(category);
  const [body, setBody] = useState(preset);
  const [email, setEmail] = useState(defaultEmail);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center pt-10 text-center">
        <Mascot mood="cheer" className="size-28" />
        <p className="mt-5 text-[22px] font-black tracking-[-0.02em]">문의를 보냈어요</p>
        <p className="mt-2 break-all text-[15px] font-semibold text-sub">{state.replyTo}로 답을 드릴게요.</p>
        <Link href={home} className="btn btn-ghost mt-8 min-h-12 px-8 text-[15px] no-underline">
          돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset>
        <legend className="text-[15px] font-extrabold">어떤 문의인가요?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {INQUIRY_CATEGORIES.map((c) => {
            const on = kind === c.id;
            return (
              <label
                key={c.id}
                className={`tile flex min-h-12 cursor-pointer items-center justify-center px-3 text-[15px] font-bold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${on ? "border-mango bg-mango-tint" : "hover:bg-snow"}`}
              >
                <input type="radio" name="category" value={c.id} checked={on} onChange={() => setKind(c.id)} className="sr-only" />
                {c.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="contact-body" className="text-[15px] font-extrabold">
          내용
        </label>
        <textarea
          id="contact-body"
          name="body"
          rows={7}
          maxLength={INQUIRY_BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="궁금한 점이나 겪은 문제를 적어 주세요. 오류라면 언제, 어느 화면에서였는지 적어 주시면 빨리 찾을 수 있어요."
          className="tile mt-2 w-full resize-y px-4 py-3 text-[16px] font-semibold leading-relaxed placeholder:text-faint"
        />
        {body.length > INQUIRY_BODY_MAX - 200 && (
          <p className="mt-1 text-right text-[12px] font-semibold tabular-nums text-sub">
            {body.length.toLocaleString("ko-KR")}/{INQUIRY_BODY_MAX.toLocaleString("ko-KR")}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contact-email" className="text-[15px] font-extrabold">
          답장 받을 메일
        </label>
        <input
          id="contact-email"
          name="replyTo"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="tile mt-2 min-h-12 w-full px-4 text-[16px] font-semibold placeholder:text-faint"
        />
      </div>

      {/* 스팸 봇만 채우는 칸(사람에게는 보이지 않고 탭으로도 가지 않는다) */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">웹사이트</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div>
        {state && !state.ok && (
          <p role="alert" className="mb-3 text-[14px] font-bold text-cherry">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn min-h-14 w-full text-[17px]">
          {pending ? <Spinner /> : "보내기"}
        </button>
        <p className="mt-3 text-center text-[13px] font-medium leading-relaxed text-sub">
          문의 내용과 회원 번호·앱 버전 같은 정보는 답하는 데만 써요.{" "}
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>
        </p>
      </div>
    </form>
  );
}
