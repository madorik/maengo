import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "../actions";
import { MangoIcon } from "@/components/MangoIcon";
import { BetaBadge } from "@/components/ui/BetaBadge";
import { demoLoginEnabled } from "@/lib/server/demo";
import { LoginButtons } from "./LoginButtons";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ error?: string; deleted?: string }> };

// 로그인: 로고와 한 줄 소개, 버튼만 둔다(소개는 / 페이지가 한다)
export default async function LoginPage({ searchParams }: Props) {
  const { error, deleted } = await searchParams;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center px-6 py-[max(32px,env(safe-area-inset-top))]">
      <Link href="/" aria-label="맹고 소개 보기" className="mx-auto flex flex-col items-center no-underline">
        <MangoIcon className="size-16" />
        <span className="mt-3 inline-flex items-center gap-2 text-[32px] font-black tracking-[-0.04em] text-mango-deep">
          맹고
          <BetaBadge />
        </span>
      </Link>
      <h1 className="mt-2 text-center text-[16px] font-semibold text-sub">관심 분야 소식을 매일 아침 골라 드려요</h1>

      <form action={signIn} className="mt-10 flex flex-col gap-3">
        {deleted && (
          <p role="status" className="text-center text-[14px] font-bold text-leaf">
            계정을 삭제했어요. 그동안 맹고를 써 주셔서 고마워요.
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-[14px] font-bold text-orange">
            로그인을 마치지 못했어요. 다시 눌러 주세요.
          </p>
        )}
        <LoginButtons demo={demoLoginEnabled()} />
      </form>
      <p className="mt-5 text-center text-[12px] font-medium text-faint">
        계속하면{" "}
        <Link href="/terms" className="font-bold text-sub underline">
          이용약관
        </Link>
        과{" "}
        <Link href="/privacy" className="font-bold text-sub underline">
          개인정보 처리방침
        </Link>
        에 동의하게 돼요. 만 14세 이상만 가입할 수 있어요.
      </p>
    </div>
  );
}
