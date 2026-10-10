import type { Metadata } from "next";
import { signIn } from "../actions";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { LoginButtons } from "./LoginButtons";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(32px,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <Bubble tail="bottom" className="rise">
          <p className="text-[16px] font-extrabold">오늘 놓치면 안 되는 소식, 제가 골라 둘게요!</p>
        </Bubble>
        <Mascot mood="cheer" className="pop mt-3 size-40" />
        <Link href="/" className="mt-2 text-[44px] font-black tracking-[-0.05em] text-mango-deep no-underline" aria-label="맹고 소개 보기">
          맹고
        </Link>
        <h1 className="mt-2 text-[24px] font-black leading-snug tracking-[-0.03em]">
          검색은 AI가,
          <br />
          당신은 듣기만.
        </h1>
        <p className="mt-3 text-[16px] font-medium leading-relaxed text-sub">
          관심사만 알려 주세요. 매일 아침 그 분야 기술 소식을 골라 읽어 드리고 들려 드려요.
        </p>
      </div>

      <form action={signIn} className="flex flex-col gap-3">
        {error === "google" && (
          <p role="alert" className="text-center text-[14px] font-bold text-orange">
            구글 로그인을 마치지 못했어요. 다시 눌러 주세요.
          </p>
        )}
        <LoginButtons />
        <p className="mt-2 text-center text-[12px] font-medium leading-relaxed text-sub">
          계속하면 이용약관과 개인정보 처리방침에 동의하게 돼요.
          <br />
          Apple 로그인은 준비 중이라 지금은 데모 계정으로 들어가요.
        </p>
      </form>
    </div>
  );
}
