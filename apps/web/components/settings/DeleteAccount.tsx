"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccount } from "@/app/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn min-h-12 flex-1 px-4 text-[15px] [--btn-edge:#C85A00] [--btn-face:var(--color-orange)] [--btn-text:#fff]"
    >
      {pending ? "지우는 중" : "계정 삭제하기"}
    </button>
  );
}

/** 설정 > 계정: 한 번 더 확인을 받고 지운다. 데모 계정은 지울 수 없다 */
export function DeleteAccount({ demo }: { demo: boolean }) {
  const [asking, setAsking] = useState(false);
  if (demo) return <p className="mt-4 text-[14px] font-semibold text-faint">데모 계정은 지울 수 없어요.</p>;
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="mt-4 text-[15px] font-extrabold text-orange hover:underline">
        계정 삭제
      </button>
    );
  }
  return (
    <div className="tile mt-4 border-orange p-4">
      <p className="text-[16px] font-black">계정을 삭제할까요?</p>
      <p className="mt-1 text-[14px] font-semibold leading-relaxed text-sub">
        관심사, 받은 맹고, 읽음·좋아요 기록, 설정이 모두 지워지고 되돌릴 수 없어요. 남은 Premium 기간도 사라져요.
      </p>
      <form action={deleteAccount} className="mt-4 flex gap-2">
        <ConfirmButton />
        <button type="button" onClick={() => setAsking(false)} className="btn btn-ghost min-h-12 flex-1 px-4 text-[15px]">
          그만두기
        </button>
      </form>
    </div>
  );
}
