import Link from "next/link";
import { AuthLink } from "@/components/landing/AuthLink";
import { MangoIcon } from "@/components/MangoIcon";
import { topicsPath } from "@/lib/public-topics";
import { SiteFooter } from "./SiteFooter";

/**
 * 공개 분야 페이지(/topics/…)의 틀. 소개 페이지와 같은 머리·바닥을 쓴다.
 * 로그인 여부에 따른 버튼만 AuthLink가 브라우저에서 바꾸고, 나머지는 정적으로 그린다.
 */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-3 px-5">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <MangoIcon className="size-9" />
            <span className="text-[26px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
          </Link>
          <nav aria-label="공개 메뉴" className="flex items-center gap-1">
            <Link href={topicsPath()} className="inline-flex min-h-11 items-center rounded-xl px-3 text-[15px] font-extrabold text-sub no-underline hover:bg-snow">
              관심 분야
            </Link>
            <Link href="/#pricing" className="hidden min-h-11 items-center rounded-xl px-3 text-[15px] font-extrabold text-sub no-underline hover:bg-snow sm:inline-flex">
              요금
            </Link>
            <AuthLink signedOut={{ href: "/login", label: "로그인" }} signedIn={{ href: "/today", label: "오늘의 소식" }} className="btn btn-ghost ml-1 min-h-11 px-4 text-[14px]" />
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

/** 페이지 아래 가입 권유. 소개 페이지 맨 아래 띠와 같은 모양 */
export function StartBand({ title, body }: { title: string; body: string }) {
  return (
    <section aria-labelledby="start-title" className="mx-auto max-w-[1100px] px-5 py-16 md:py-20">
      <div className="keep-light flex flex-col items-center gap-6 rounded-3xl bg-mango px-6 py-10 text-center shadow-[0_6px_0_var(--color-mango-dark)] md:flex-row md:px-12 md:text-left">
        <div className="flex-1">
          <h2 id="start-title" className="text-[24px] font-black leading-snug tracking-[-0.03em] md:text-[30px]">
            {title}
          </h2>
          <p className="mt-2 text-[16px] font-semibold text-ink/75">{body}</p>
        </div>
        <AuthLink
          signedOut={{ href: "/login", label: "무료로 시작하기" }}
          signedIn={{ href: "/today", label: "오늘의 소식 열기" }}
          className="btn btn-ink min-h-14 shrink-0 px-8 text-[17px]"
        />
      </div>
    </section>
  );
}

/** 구조화 데이터(JSON-LD). '<'를 이스케이프해 글 제목에 든 태그가 스크립트를 닫지 못하게 한다 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
