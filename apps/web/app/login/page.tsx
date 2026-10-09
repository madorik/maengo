import type { Metadata } from "next";
import { signIn } from "../actions";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { LoginButtons } from "./LoginButtons";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(32px,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <Bubble tail="bottom" className="rise">
          <p className="text-[16px] font-extrabold">오늘 놓치면 안 되는 소식, 제가 골라 둘게요!</p>
        </Bubble>
        <Mascot mood="cheer" className="pop mt-3 size-40" />
        <p className="mt-2 text-[44px] font-black tracking-[-0.05em] text-mango-deep">맹고</p>
        <h1 className="mt-2 text-[24px] font-black leading-snug tracking-[-0.03em]">
          검색은 AI가,
          <br />
          당신은 듣기만.
        </h1>
        <p className="mt-3 text-[16px] font-medium leading-relaxed text-sub">
          직업과 관심사만 알려 주세요. 매일 아침 기술 소식을 골라 읽어 드리고 들려 드려요.
        </p>
      </div>

      <form action={signIn} className="flex flex-col gap-3">
        <LoginButtons />
        <p className="mt-2 text-center text-[12px] font-medium leading-relaxed text-sub">
          계속하면 이용약관과 개인정보 처리방침에 동의하게 돼요.
          <br />
          지금은 데모 로그인이라 버튼을 누르면 바로 들어가요.
        </p>
      </form>
    </div>
  );
}
