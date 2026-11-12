import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "../actions";
import { IconHeadphones } from "@/components/icons";
import { MangoIcon } from "@/components/MangoIcon";
import { demoLoginEnabled } from "@/lib/server/demo";
import { LoginButtons } from "./LoginButtons";
import { youtubeInterestsEnabled } from "@/lib/server/youtube-interests";

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
        </span>
      </Link>
      {/* 2026-11-12 재테크하는 직장인(맹고-문서/타겟.md): 대표 문장 '내 관심 분야 소식, 오늘 뉴스 핵심 요약'(2026-11-12 사용자). App Store 부제·공유 이미지와 같은 말 */}
      <h1 className="mt-2 text-center text-[16px] font-semibold text-sub">내 관심 분야 소식, 오늘 뉴스 핵심 요약</h1>

      <form action={signIn} className="mt-10 flex flex-col gap-3">
        {deleted && (
          <p role="status" className="text-center text-[14px] font-bold text-leaf">
            계정을 삭제했어요. 그동안 맹고를 써 주셔서 고마워요.
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-[14px] font-bold text-cherry">
            로그인을 마치지 못했어요. 다시 눌러 주세요.
          </p>
        )}
        <LoginButtons demo={demoLoginEnabled()} youtube={youtubeInterestsEnabled()} />
      </form>
      {/* 로그인 없이 이미 만든 음성 소식 몇 개를 들어 본다(app/try, 2026-11-07). 앱은 로그인 전이면 이 화면으로 열려서 여기가 입구다 */}
      <Link
        href="/try"
        className="mx-auto mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[15px] font-extrabold text-sky-dark no-underline hover:bg-snow"
      >
        <IconHeadphones className="size-5" />
        로그인 없이 둘러보기
      </Link>
      <p className="mt-5 text-center text-[13px] font-medium leading-relaxed text-sub">
        계속하면{" "}
        <Link href="/terms" className="font-bold text-sub underline">
          이용약관
        </Link>
        과{" "}
        <Link href="/privacy" className="font-bold text-sub underline">
          개인정보 처리방침
        </Link>
        에 동의하게 돼요.
      </p>
    </div>
  );
}
